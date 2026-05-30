import type { Viewport } from '@xyflow/react'
import { FILE_VERSION, LEGACY_STORAGE_KEY, STORAGE_KEY, WORKSPACE_VERSION } from '../lib/persistence'
import { PRODUCT_NAME } from '../lib/brand'
import type {
  ChatFlowEdge,
  ChatFlowNode,
  LayoutDirection,
} from '../types/conversation'
import type { GraphSnapshot, Project, WorkspaceStorage } from '../types/project'

export interface SavedConversation {
  version: typeof FILE_VERSION
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
  layoutDirection: LayoutDirection
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSavedConversation(value: unknown): value is SavedConversation {
  if (!isRecord(value)) return false
  return (
    value.version === FILE_VERSION &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    isRecord(value.viewport) &&
    (value.layoutDirection === 'TB' || value.layoutDirection === 'LR')
  )
}

function isWorkspaceStorage(value: unknown): value is WorkspaceStorage {
  if (!isRecord(value)) return false
  return value.version === WORKSPACE_VERSION && Array.isArray(value.projects)
}

export function createProjectId() {
  return `proj_${crypto.randomUUID()}`
}

export function createDefaultProject(name = '未命名项目'): Project {
  const id = createProjectId()
  const now = new Date().toISOString()
  return {
    id,
    name,
    updatedAt: now,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    layoutDirection: 'TB',
  }
}

export function createDefaultWorkspace(): WorkspaceStorage {
  const project = createDefaultProject(PRODUCT_NAME)
  return {
    version: WORKSPACE_VERSION,
    activeProjectId: project.id,
    projects: [project],
  }
}

function migrateV1ToWorkspace(saved: SavedConversation): WorkspaceStorage {
  const project = createDefaultProject(PRODUCT_NAME)
  return {
    version: WORKSPACE_VERSION,
    activeProjectId: project.id,
    projects: [
      {
        ...project,
        nodes: saved.nodes,
        edges: saved.edges,
        viewport: saved.viewport,
        layoutDirection: saved.layoutDirection,
        updatedAt: new Date().toISOString(),
      },
    ],
  }
}

export function serializeConversation(state: {
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
  layoutDirection: LayoutDirection
}): SavedConversation {
  return {
    version: FILE_VERSION,
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
    layoutDirection: state.layoutDirection,
  }
}

export function parseConversationJson(raw: string): SavedConversation {
  const parsed: unknown = JSON.parse(raw)
  if (!isSavedConversation(parsed)) {
    throw new Error('Invalid conversation file format.')
  }
  return parsed
}

export function buildWorkspaceFromState(state: {
  activeProjectId: string
  projects: Project[]
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
  layoutDirection: LayoutDirection
}): WorkspaceStorage {
  const now = new Date().toISOString()
  const projects = state.projects.map((project) =>
    project.id === state.activeProjectId
      ? {
          ...project,
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
          layoutDirection: state.layoutDirection,
          updatedAt: now,
        }
      : project,
  )

  return {
    version: WORKSPACE_VERSION,
    activeProjectId: state.activeProjectId,
    projects,
  }
}

export function saveWorkspace(data: WorkspaceStorage): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadWorkspace(): WorkspaceStorage {
  const raw =
    localStorage.getItem(STORAGE_KEY) ??
    localStorage.getItem(LEGACY_STORAGE_KEY)
  if (!raw) return createDefaultWorkspace()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (isWorkspaceStorage(parsed) && parsed.projects.length > 0) {
      if (!localStorage.getItem(STORAGE_KEY)) {
        saveWorkspace(parsed)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
      }
      return parsed
    }
    if (isSavedConversation(parsed)) {
      const workspace = migrateV1ToWorkspace(parsed)
      saveWorkspace(workspace)
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return workspace
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  }

  return createDefaultWorkspace()
}

export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function downloadConversationJson(data: SavedConversation): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `branch-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function cloneGraphSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return structuredClone(snapshot)
}

export function snapshotFromGraph(state: {
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
  layoutDirection: LayoutDirection
  selectedNodeId: string | null
}): GraphSnapshot {
  return cloneGraphSnapshot({
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
    layoutDirection: state.layoutDirection,
    selectedNodeId: state.selectedNodeId,
  })
}

export function projectToSnapshot(project: Project): GraphSnapshot {
  return {
    nodes: project.nodes,
    edges: project.edges,
    viewport: project.viewport,
    layoutDirection: project.layoutDirection,
    selectedNodeId: null,
  }
}
