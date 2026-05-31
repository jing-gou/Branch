import { create } from 'zustand'
import type { Viewport } from '@xyflow/react'
import { DEFAULT_LAYOUT_DIRECTION, EDGE_TYPE } from '../lib/constants'
import { PRODUCT_NAME } from '../lib/brand'
import { MAX_HISTORY } from '../lib/persistence'
import type {
  ChatFlowEdge,
  ChatFlowNode,
  ConversationGraph,
  LayoutDirection,
  MessageRole,
  ParsedConversation,
} from '../types/conversation'
import type { GraphSnapshot, Project, WorkspaceStorage } from '../types/project'
import { createEdgeId, createMessageId } from '../utils/ids'
import { wouldCreateCycle } from '../utils/graphValidation'
import { layoutTree } from '../utils/layoutTree'
import { buildMergedNode, rewireEdgesForMerge } from '../utils/mergeNodes'
import {
  canMergeAsQaPair,
  createMergedNodeData,
  createSingleNodeData,
  defaultNodeDimensions,
  getNodeMessages,
} from '../utils/nodeMessages'
import type { SavedConversation } from '../utils/persistence'
import {
  cloneGraphSnapshot,
  createDefaultProject,
  projectToSnapshot,
  snapshotFromGraph,
} from '../utils/persistence'
import { collectSubtree } from '../utils/treeQueries'
import {
  geminiTurnsToFlowGraph,
  parseGeminiShareHtml,
} from '../utils/parseGeminiShareHtml'
import { loadReadOnlyMode, saveReadOnlyMode } from '../lib/readOnlyMode'

const INITIAL_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

let suppressHistory = false

interface ConversationState {
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
  graphVersion: number
  layoutDirection: LayoutDirection
  selectedNodeId: string | null
  selectedNodeIds: string[]
  selectedEdgeId: string | null
  editingTarget: { nodeId: string; messageIndex: number } | null
  lastSavedAt: number

  activeProjectId: string
  projects: Project[]
  past: GraphSnapshot[]
  future: GraphSnapshot[]

  readOnlyMode: boolean
  setReadOnlyMode: (enabled: boolean) => void
  toggleReadOnlyMode: () => void

  setViewport: (viewport: Viewport) => void
  setSelectedNodeId: (nodeId: string | null) => void
  setSelectedNodeIds: (nodeIds: string[]) => void
  setSelectedEdgeId: (edgeId: string | null) => void
  setEditingTarget: (target: { nodeId: string; messageIndex: number } | null) => void
  clearEditingTarget: () => void
  pushHistory: () => void
  clearHistory: () => void
  undo: () => void
  redo: () => void

  loadGraph: (graph: ConversationGraph) => void
  hydrate: (saved: SavedConversation) => void
  hydrateWorkspace: (workspace: WorkspaceStorage) => void
  resetGraph: () => void

  createProject: (name?: string) => void
  switchProject: (projectId: string) => void
  renameProject: (projectId: string, name: string) => void
  deleteProject: (projectId: string) => void

  updateMessage: (nodeId: string, content: string, messageIndex?: number) => void
  mergeQaNodes: (firstNodeId: string, secondNodeId: string) => void
  updateNodeSize: (nodeId: string, width: number, height: number) => void
  deleteNode: (nodeId: string) => void
  addChildNode: (parentId: string, role: MessageRole) => string
  addBlock: (role: MessageRole, content?: string) => string
  addQaBlock: () => string
  connectNodes: (sourceId: string, targetId: string) => void
  disconnectEdge: (edgeId: string) => void
  importParsedConversation: (parsed: ParsedConversation) => void
  importGeminiAsNewProject: (html: string, projectName?: string) => void
  setLayoutDirection: (direction: LayoutDirection) => void
  applyAutoLayout: (direction: LayoutDirection) => void
}

function applyLayout(
  nodes: ChatFlowNode[],
  edges: ChatFlowEdge[],
  direction: LayoutDirection,
) {
  return layoutTree(nodes, edges, direction)
}

function resolveParentNode(
  nodes: ChatFlowNode[],
  selectedNodeId: string | null,
): ChatFlowNode | null {
  if (nodes.length === 0) return null

  if (selectedNodeId) {
    const selected = nodes.find((node) => node.id === selectedNodeId)
    if (selected) return selected
  }

  return nodes[nodes.length - 1]
}

function syncProjectsWithCanvas(
  projects: Project[],
  activeProjectId: string,
  canvas: {
    nodes: ChatFlowNode[]
    edges: ChatFlowEdge[]
    viewport: Viewport
    layoutDirection: LayoutDirection
  },
): Project[] {
  const now = new Date().toISOString()
  return projects.map((project) =>
    project.id === activeProjectId
      ? {
          ...project,
          nodes: canvas.nodes,
          edges: canvas.edges,
          viewport: canvas.viewport,
          layoutDirection: canvas.layoutDirection,
          updatedAt: now,
        }
      : project,
  )
}

function applySnapshot(snapshot: GraphSnapshot) {
  return {
    nodes: applyLayout(snapshot.nodes, snapshot.edges, snapshot.layoutDirection),
    edges: snapshot.edges,
    viewport: snapshot.viewport,
    layoutDirection: snapshot.layoutDirection,
    selectedNodeId: snapshot.selectedNodeId,
    selectedNodeIds: snapshot.selectedNodeId ? [snapshot.selectedNodeId] : [],
  }
}

function withHistory<T>(get: () => ConversationState, run: () => T): T {
  if (!suppressHistory) {
    get().pushHistory()
  }
  return run()
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: INITIAL_VIEWPORT,
  graphVersion: 0,
  layoutDirection: DEFAULT_LAYOUT_DIRECTION,
  selectedNodeId: null,
  selectedNodeIds: [],
  selectedEdgeId: null,
  editingTarget: null,
  lastSavedAt: 0,

  activeProjectId: '',
  projects: [],
  past: [],
  future: [],

  readOnlyMode: loadReadOnlyMode(),

  setReadOnlyMode: (enabled) => {
    saveReadOnlyMode(enabled)
    set({
      readOnlyMode: enabled,
      ...(enabled
        ? {
            selectedNodeId: null,
            selectedNodeIds: [],
            selectedEdgeId: null,
            editingTarget: null,
          }
        : {}),
    })
  },

  toggleReadOnlyMode: () => get().setReadOnlyMode(!get().readOnlyMode),

  setViewport: (viewport) => set({ viewport }),

  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),

  setSelectedNodeIds: (nodeIds) =>
    set({
      selectedNodeIds: nodeIds,
      selectedNodeId: nodeIds.length === 1 ? nodeIds[0] : null,
    }),

  setSelectedEdgeId: (edgeId) => set({ selectedEdgeId: edgeId }),

  setEditingTarget: (target) => set({ editingTarget: target }),

  clearEditingTarget: () => set({ editingTarget: null }),

  pushHistory: () => {
    if (suppressHistory) return
    const snapshot = snapshotFromGraph(get())
    set({
      past: [...get().past, snapshot].slice(-MAX_HISTORY),
      future: [],
    })
  },

  clearHistory: () => set({ past: [], future: [] }),

  undo: () => {
    const { past, future } = get()
    if (past.length === 0) return

    const previous = past[past.length - 1]
    const current = snapshotFromGraph(get())

    suppressHistory = true
    set({
      ...applySnapshot(previous),
      past: past.slice(0, -1),
      future: [cloneGraphSnapshot(current), ...future],
      graphVersion: get().graphVersion + 1,
    })
    suppressHistory = false
  },

  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return

    const next = future[0]
    const current = snapshotFromGraph(get())

    suppressHistory = true
    set({
      ...applySnapshot(next),
      past: [...past, cloneGraphSnapshot(current)],
      future: future.slice(1),
      graphVersion: get().graphVersion + 1,
    })
    suppressHistory = false
  },

  loadGraph: (graph) =>
    withHistory(get, () => {
      set({
        nodes: graph.nodes,
        edges: graph.edges,
        viewport: graph.viewport,
        graphVersion: get().graphVersion + 1,
      })
    }),

  hydrate: (saved) => {
    suppressHistory = true
    set({
      nodes: applyLayout(saved.nodes, saved.edges, saved.layoutDirection),
      edges: saved.edges,
      viewport: saved.viewport,
      layoutDirection: saved.layoutDirection,
      selectedNodeId: null,
      selectedNodeIds: [],
      graphVersion: get().graphVersion + 1,
      past: [],
      future: [],
    })
    suppressHistory = false
  },

  hydrateWorkspace: (workspace) => {
    const active =
      workspace.projects.find(
        (project) => project.id === workspace.activeProjectId,
      ) ?? workspace.projects[0]

    suppressHistory = true
    set({
      activeProjectId: active.id,
      projects: workspace.projects,
      ...applySnapshot(projectToSnapshot(active)),
      graphVersion: get().graphVersion + 1,
      past: [],
      future: [],
    })
    suppressHistory = false
  },

  resetGraph: () =>
    withHistory(get, () => {
      set({
        nodes: [],
        edges: [],
        viewport: INITIAL_VIEWPORT,
        selectedNodeId: null,
        selectedNodeIds: [],
        graphVersion: get().graphVersion + 1,
        projects: syncProjectsWithCanvas(get().projects, get().activeProjectId, {
          nodes: [],
          edges: [],
          viewport: INITIAL_VIEWPORT,
          layoutDirection: get().layoutDirection,
        }),
      })
    }),

  createProject: (name) => {
    const state = get()
    const syncedProjects = syncProjectsWithCanvas(
      state.projects,
      state.activeProjectId,
      state,
    )
    const newProject = createDefaultProject(
      name ?? `${PRODUCT_NAME} ${syncedProjects.length + 1}`,
    )

    suppressHistory = true
    set({
      projects: [...syncedProjects, newProject],
      activeProjectId: newProject.id,
      nodes: [],
      edges: [],
      viewport: INITIAL_VIEWPORT,
      layoutDirection: DEFAULT_LAYOUT_DIRECTION,
      selectedNodeId: null,
      selectedNodeIds: [],
      graphVersion: get().graphVersion + 1,
      past: [],
      future: [],
    })
    suppressHistory = false
  },

  switchProject: (projectId) => {
    const state = get()
    if (projectId === state.activeProjectId) return

    const target = state.projects.find((project) => project.id === projectId)
    if (!target) return

    const syncedProjects = syncProjectsWithCanvas(
      state.projects,
      state.activeProjectId,
      state,
    )
    const nextProject =
      syncedProjects.find((project) => project.id === projectId) ?? target

    suppressHistory = true
    set({
      projects: syncedProjects,
      activeProjectId: projectId,
      ...applySnapshot(projectToSnapshot(nextProject)),
      graphVersion: get().graphVersion + 1,
      past: [],
      future: [],
    })
    suppressHistory = false
  },

  renameProject: (projectId, name) => {
    const trimmed = name.trim()
    if (!trimmed) return

    set({
      projects: get().projects.map((project) =>
        project.id === projectId
          ? { ...project, name: trimmed, updatedAt: new Date().toISOString() }
          : project,
      ),
    })
  },

  deleteProject: (projectId) => {
    const state = get()
    const syncedProjects = syncProjectsWithCanvas(
      state.projects,
      state.activeProjectId,
      state,
    )
    const remaining = syncedProjects.filter(
      (project) => project.id !== projectId,
    )

    if (remaining.length === 0) {
      get().createProject(PRODUCT_NAME)
      return
    }

    if (projectId !== state.activeProjectId) {
      set({ projects: remaining })
      return
    }

    const nextProject = remaining[0]
    suppressHistory = true
    set({
      projects: remaining,
      activeProjectId: nextProject.id,
      ...applySnapshot(projectToSnapshot(nextProject)),
      graphVersion: get().graphVersion + 1,
      past: [],
      future: [],
    })
    suppressHistory = false
  },

  updateMessage: (nodeId, content, messageIndex = 0) =>
    withHistory(get, () => {
      const now = new Date().toISOString()
      set({
        nodes: get().nodes.map((node) => {
          if (node.id !== nodeId) return node

          const messages = getNodeMessages(node.data).map((message, index) =>
            index === messageIndex
              ? { ...message, content, updatedAt: now }
              : message,
          )

          return {
            ...node,
            data: {
              ...node.data,
              messages,
              message: messages.length === 1 ? messages[0] : undefined,
            },
          }
        }),
      })
    }),

  mergeQaNodes: (firstNodeId, secondNodeId) =>
    withHistory(get, () => {
      const { nodes, edges, layoutDirection } = get()
      const pair = canMergeAsQaPair(nodes, firstNodeId, secondNodeId)
      if (!pair) return

      const { userNode, assistantNode } = pair
      const mergedNode = buildMergedNode(userNode, assistantNode)
      const nextNodes = [
        ...nodes.filter(
          (node) => node.id !== userNode.id && node.id !== assistantNode.id,
        ),
        mergedNode,
      ]
      const nextEdges = rewireEdgesForMerge(
        edges,
        userNode.id,
        assistantNode.id,
        mergedNode.id,
      )

      set({
        nodes: applyLayout(nextNodes, nextEdges, layoutDirection),
        edges: nextEdges,
        selectedNodeId: mergedNode.id,
        selectedNodeIds: [mergedNode.id],
        graphVersion: get().graphVersion + 1,
      })
    }),

  updateNodeSize: (nodeId, width, height) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                width: Math.round(width),
                height: Math.round(height),
              },
            }
          : node,
      ),
    })
  },

  deleteNode: (nodeId) =>
    withHistory(get, () => {
      const { nodes, edges, layoutDirection, selectedNodeId, selectedNodeIds } =
        get()
      const toRemove = new Set([nodeId, ...collectSubtree(nodeId, edges)])
      const nextNodes = nodes.filter((node) => !toRemove.has(node.id))
      const nextEdges = edges.filter(
        (edge) => !toRemove.has(edge.source) && !toRemove.has(edge.target),
      )

      set({
        nodes: applyLayout(nextNodes, nextEdges, layoutDirection),
        edges: nextEdges,
        selectedNodeId:
          selectedNodeId && toRemove.has(selectedNodeId) ? null : selectedNodeId,
        selectedNodeIds: selectedNodeIds.filter((id) => !toRemove.has(id)),
        graphVersion: get().graphVersion + 1,
      })
    }),

  addChildNode: (parentId, role) => {
    let newId = ''
    withHistory(get, () => {
      const id = createMessageId()
      newId = id
      const newNode: ChatFlowNode = {
        id,
        type: 'chatNode',
        position: { x: 0, y: 0 },
        data: createSingleNodeData(role, ''),
      }
      const newEdge: ChatFlowEdge = {
        id: createEdgeId(parentId, id),
        source: parentId,
        target: id,
        type: EDGE_TYPE,
      }

      const { nodes, edges, layoutDirection } = get()
      const nextNodes = [...nodes, newNode]
      const nextEdges = [...edges, newEdge]

      set({
        nodes: applyLayout(nextNodes, nextEdges, layoutDirection),
        edges: nextEdges,
        selectedNodeId: id,
        selectedNodeIds: [id],
        editingTarget: { nodeId: id, messageIndex: 0 },
        graphVersion: get().graphVersion + 1,
      })
    })
    return newId
  },

  addBlock: (role, content = '') => {
    let newId = ''
    withHistory(get, () => {
      const id = createMessageId()
      newId = id
      const { nodes, edges, layoutDirection, selectedNodeId } = get()
      const parentNode = resolveParentNode(nodes, selectedNodeId)

      const newNode: ChatFlowNode = {
        id,
        type: 'chatNode',
        position: { x: 0, y: 0 },
        data: createSingleNodeData(role, content),
      }

      const nextNodes = [...nodes, newNode]
      const nextEdges = parentNode
        ? [
            ...edges,
            {
              id: createEdgeId(parentNode.id, id),
              source: parentNode.id,
              target: id,
              type: EDGE_TYPE,
            },
          ]
        : edges

      set({
        nodes: applyLayout(nextNodes, nextEdges, layoutDirection),
        edges: nextEdges,
        selectedNodeId: id,
        selectedNodeIds: [id],
        editingTarget: { nodeId: id, messageIndex: 0 },
        graphVersion: get().graphVersion + 1,
      })
    })
    return newId
  },

  addQaBlock: () => {
    let newId = ''
    withHistory(get, () => {
      const id = createMessageId()
      newId = id
      const { nodes, edges, layoutDirection, selectedNodeId } = get()
      const parentNode = resolveParentNode(nodes, selectedNodeId)

      const newNode: ChatFlowNode = {
        id,
        type: 'chatNode',
        position: { x: 0, y: 0 },
        data: createMergedNodeData(),
      }

      const nextNodes = [...nodes, newNode]
      const nextEdges = parentNode
        ? [
            ...edges,
            {
              id: createEdgeId(parentNode.id, id),
              source: parentNode.id,
              target: id,
              type: EDGE_TYPE,
            },
          ]
        : edges

      set({
        nodes: applyLayout(nextNodes, nextEdges, layoutDirection),
        edges: nextEdges,
        selectedNodeId: id,
        selectedNodeIds: [id],
        editingTarget: { nodeId: id, messageIndex: 0 },
        graphVersion: get().graphVersion + 1,
      })
    })
    return newId
  },

  connectNodes: (sourceId, targetId) =>
    withHistory(get, () => {
      const edgeId = createEdgeId(sourceId, targetId)
      const { nodes, edges, layoutDirection } = get()

      if (edges.some((edge) => edge.id === edgeId)) return
      if (wouldCreateCycle(sourceId, targetId, edges)) return

      const nextEdges = [
        ...edges,
        {
          id: edgeId,
          source: sourceId,
          target: targetId,
          type: EDGE_TYPE,
        },
      ]

      set({
        edges: nextEdges,
        nodes: applyLayout(nodes, nextEdges, layoutDirection),
        graphVersion: get().graphVersion + 1,
      })
    }),

  disconnectEdge: (edgeId) =>
    withHistory(get, () => {
      const { selectedEdgeId } = get()

      set({
        edges: get().edges.filter((edge) => edge.id !== edgeId),
        selectedEdgeId: selectedEdgeId === edgeId ? null : selectedEdgeId,
        graphVersion: get().graphVersion + 1,
      })
    }),

  importParsedConversation: (parsed) =>
    withHistory(get, () => {
      const { layoutDirection } = get()
      const nodes: ChatFlowNode[] = parsed.messages.map((message) => ({
        id: message.id,
        type: 'chatNode',
        position: { x: 0, y: 0 },
        data: {
          messages: [message],
          message,
          ...defaultNodeDimensions(),
        },
      }))

      const edges: ChatFlowEdge[] = parsed.links
        .filter((link) => link.parentId !== null)
        .map((link) => ({
          id: createEdgeId(link.parentId!, link.childId),
          source: link.parentId!,
          target: link.childId,
          type: EDGE_TYPE,
        }))

      set({
        nodes: applyLayout(nodes, edges, layoutDirection),
        edges,
        selectedNodeId: null,
        selectedNodeIds: [],
        graphVersion: get().graphVersion + 1,
      })
    }),

  importGeminiAsNewProject: (html, projectName) => {
    const { title, turns } = parseGeminiShareHtml(html)
    const { nodes, edges } = geminiTurnsToFlowGraph(turns)
    const layoutDirection = DEFAULT_LAYOUT_DIRECTION
    const laidOut = applyLayout(nodes, edges, layoutDirection)
    const now = new Date().toISOString()
    const name = (projectName ?? title).trim().slice(0, 80) || 'Gemini 对话'

    const state = get()
    const syncedProjects = syncProjectsWithCanvas(
      state.projects,
      state.activeProjectId,
      state,
    )
    const newProject = createDefaultProject(name)
    const projectWithGraph: Project = {
      ...newProject,
      nodes: laidOut,
      edges,
      updatedAt: now,
    }

    suppressHistory = true
    set({
      projects: [...syncedProjects, projectWithGraph],
      activeProjectId: projectWithGraph.id,
      nodes: laidOut,
      edges,
      viewport: INITIAL_VIEWPORT,
      layoutDirection,
      selectedNodeId: null,
      selectedNodeIds: [],
      editingTarget: null,
      graphVersion: get().graphVersion + 1,
      past: [],
      future: [],
    })
    suppressHistory = false
  },

  setLayoutDirection: (direction) =>
    withHistory(get, () => {
      const { nodes, edges } = get()

      set({
        layoutDirection: direction,
        nodes: applyLayout(nodes, edges, direction),
        graphVersion: get().graphVersion + 1,
      })
    }),

  applyAutoLayout: (direction) => {
    get().setLayoutDirection(direction)
  },
}))
