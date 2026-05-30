import { WEBDAV_SYNC_ENVELOPE_VERSION } from '../lib/webdav'
import type { WorkspaceStorage } from '../types/project'
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
  action: 'pushed' | 'pulled' | 'noop'
  envelope?: WebDavSyncEnvelope
}> {
  const remote = await pullWorkspaceFromWebDav(config)

  if (!remote) {
    const envelope = await pushWorkspaceToWebDav(config, localWorkspace)
    return { action: 'pushed', envelope }
  }

  const localLatest = getWorkspaceLatestUpdatedAt(localWorkspace)
  const remoteLatest = getWorkspaceLatestUpdatedAt(remote.workspace)

  if (remoteLatest > localLatest) {
    saveWorkspace(remote.workspace)
    return { action: 'pulled', envelope: remote }
  }

  if (localLatest > remoteLatest) {
    const envelope = await pushWorkspaceToWebDav(config, localWorkspace)
    return { action: 'pushed', envelope }
  }

  return { action: 'noop', envelope: remote }
}

export { WebDavError }
