import { WEBDAV_SYNC_ENVELOPE_VERSION } from '../lib/webdav'
import { WORKSPACE_VERSION } from '../lib/persistence'
import type { Project, WorkspaceStorage } from '../types/project'
import type { WebDavConfig, WebDavSyncEnvelope } from '../types/webdav'
import { saveWorkspace } from './persistence'
import {
  getRemoteFileText,
  putRemoteFileText,
  testWebDavConnection,
  WebDavError,
} from './webdavClient'
import { validateWebDavConfig } from './webdavConfig'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWorkspaceStorage(value: unknown): value is WorkspaceStorage {
  if (!isRecord(value)) return false
  return value.version === 2 && Array.isArray(value.projects)
}

export function parseSyncEnvelope(raw: string): WebDavSyncEnvelope {
  const parsed: unknown = JSON.parse(raw)
  if (!isRecord(parsed)) {
    throw new Error('远程文件格式无效')
  }

  if (
    parsed.version !== WEBDAV_SYNC_ENVELOPE_VERSION ||
    typeof parsed.exportedAt !== 'string' ||
    !isWorkspaceStorage(parsed.workspace)
  ) {
    throw new Error('远程 workspace 格式无效')
  }

  if (parsed.workspace.projects.length === 0) {
    throw new Error('远程 workspace 不包含任何项目')
  }

  return {
    version: WEBDAV_SYNC_ENVELOPE_VERSION,
    exportedAt: parsed.exportedAt,
    workspace: parsed.workspace,
  }
}

export function createSyncEnvelope(workspace: WorkspaceStorage): WebDavSyncEnvelope {
  return {
    version: WEBDAV_SYNC_ENVELOPE_VERSION,
    exportedAt: new Date().toISOString(),
    workspace,
  }
}

export function getWorkspaceLatestUpdatedAt(workspace: WorkspaceStorage): number {
  return workspace.projects.reduce((latest, project) => {
    const time = Date.parse(project.updatedAt)
    return Number.isNaN(time) ? latest : Math.max(latest, time)
  }, 0)
}

function workspaceSignature(workspace: WorkspaceStorage): string {
  return workspace.projects
    .map((project) => `${project.id}:${project.updatedAt}`)
    .sort()
    .join('|')
}

export function mergeWorkspaces(
  local: WorkspaceStorage,
  remote: WorkspaceStorage,
): WorkspaceStorage {
  const merged = new Map<string, Project>()

  for (const project of remote.projects) {
    merged.set(project.id, project)
  }

  for (const project of local.projects) {
    const existing = merged.get(project.id)
    if (!existing) {
      merged.set(project.id, project)
      continue
    }

    const localTime = Date.parse(project.updatedAt)
    const remoteTime = Date.parse(existing.updatedAt)
    const useLocal =
      Number.isNaN(remoteTime) ||
      (!Number.isNaN(localTime) && localTime >= remoteTime)

    merged.set(project.id, useLocal ? project : existing)
  }

  const projects = [...merged.values()].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )

  if (projects.length === 0) {
    return local.projects.length > 0 ? local : remote
  }

  const activeProjectId =
    projects.find((project) => project.id === local.activeProjectId)?.id ??
    projects.find((project) => project.id === remote.activeProjectId)?.id ??
    projects[0].id

  return {
    version: WORKSPACE_VERSION,
    activeProjectId,
    projects,
  }
}

export async function pushWorkspaceToWebDav(
  config: WebDavConfig,
  workspace: WorkspaceStorage,
): Promise<WebDavSyncEnvelope> {
  const validationError = validateWebDavConfig(config)
  if (validationError) throw new WebDavError(validationError)

  const envelope = createSyncEnvelope(workspace)
  await putRemoteFileText(config, JSON.stringify(envelope, null, 2))
  return envelope
}

export async function pullWorkspaceFromWebDav(
  config: WebDavConfig,
): Promise<WebDavSyncEnvelope | null> {
  const validationError = validateWebDavConfig(config)
  if (validationError) throw new WebDavError(validationError)

  const raw = await getRemoteFileText(config)
  if (!raw) return null

  return parseSyncEnvelope(raw)
}

export async function testWebDavSetup(config: WebDavConfig): Promise<void> {
  const validationError = validateWebDavConfig(config)
  if (validationError) throw new WebDavError(validationError)
  await testWebDavConnection(config)
}

export async function syncWorkspaceWithWebDav(
  config: WebDavConfig,
  localWorkspace: WorkspaceStorage,
): Promise<{
  action: 'pushed' | 'pulled' | 'merged' | 'noop'
  envelope?: WebDavSyncEnvelope
}> {
  const remote = await pullWorkspaceFromWebDav(config)

  if (!remote) {
    const envelope = await pushWorkspaceToWebDav(config, localWorkspace)
    return { action: 'pushed', envelope }
  }

  const merged = mergeWorkspaces(localWorkspace, remote.workspace)
  const mergedSignature = workspaceSignature(merged)
  const localSignature = workspaceSignature(localWorkspace)
  const remoteSignature = workspaceSignature(remote.workspace)

  if (mergedSignature === localSignature && mergedSignature === remoteSignature) {
    return { action: 'noop', envelope: remote }
  }

  saveWorkspace(merged)
  const envelope = await pushWorkspaceToWebDav(config, merged)

  const localIds = new Set(localWorkspace.projects.map((project) => project.id))
  const remoteIds = new Set(remote.workspace.projects.map((project) => project.id))
  const addedFromRemote = merged.projects.some((project) => !localIds.has(project.id))
  const addedFromLocal = merged.projects.some((project) => !remoteIds.has(project.id))

  if (addedFromRemote && addedFromLocal) {
    return { action: 'merged', envelope }
  }
  if (addedFromRemote || mergedSignature !== localSignature) {
    return { action: 'pulled', envelope }
  }
  return { action: 'pushed', envelope }
}

export { WebDavError }
