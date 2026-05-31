import { useCallback, useEffect, useMemo } from 'react'
import { Menu } from 'lucide-react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { NODE_TYPES } from '../../lib/constants'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useConversationStore } from '../../store/conversationStore'
import type { ChatFlowEdge, ChatFlowNode } from '../../types/conversation'
import { BlockFab } from './BlockFab'
import { CanvasToolbar } from './CanvasToolbar'
import { ChatNode } from './ChatNode'
import { PRODUCT_NAME } from '../../lib/brand'

const nodeTypes = {
  [NODE_TYPES.chatNode]: ChatNode,
}

function FitViewOnGraphChange() {
  const graphVersion = useConversationStore((state) => state.graphVersion)
  const nodeCount = useConversationStore((state) => state.nodes.length)
  const isMobile = useIsMobile()
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (nodeCount === 0) return
    void fitView({
      padding: isMobile ? 0.35 : 0.25,
      duration: 300,
    })
  }, [graphVersion, nodeCount, fitView, isMobile])

  return null
}

function CanvasInner() {
  const isMobile = useIsMobile()
  const readOnlyMode = useConversationStore((state) => state.readOnlyMode)
  const nodes = useConversationStore((state) => state.nodes)
  const edges = useConversationStore((state) => state.edges)
  const viewport = useConversationStore((state) => state.viewport)
  const setViewport = useConversationStore((state) => state.setViewport)
  const setSelectedNodeIds = useConversationStore((state) => state.setSelectedNodeIds)
  const setSelectedEdgeId = useConversationStore((state) => state.setSelectedEdgeId)
  const pushHistory = useConversationStore((state) => state.pushHistory)
  const connectNodes = useConversationStore((state) => state.connectNodes)
  const deleteNode = useConversationStore((state) => state.deleteNode)
  const disconnectEdge = useConversationStore((state) => state.disconnectEdge)

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnlyMode) {
        const filtered = changes.filter(
          (change) => change.type !== 'position' && change.type !== 'dimensions',
        )
        if (filtered.length === 0) return
        changes = filtered
      }

      const filtered = changes.filter((change) => change.type !== 'remove')
      if (filtered.length === 0) return

      useConversationStore.setState({
        nodes: applyNodeChanges(
          filtered,
          useConversationStore.getState().nodes,
        ) as ChatFlowNode[],
      })
    },
    [readOnlyMode],
  )

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const filtered = changes.filter((change) => change.type !== 'remove')
    if (filtered.length === 0) return

    useConversationStore.setState({
      edges: applyEdgeChanges(
        filtered,
        useConversationStore.getState().edges,
      ) as ChatFlowEdge[],
    })
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      connectNodes(connection.source, connection.target)
    },
    [connectNodes],
  )

  const onNodesDelete = useCallback(
    (deletedNodes: { id: string }[]) => {
      deletedNodes.forEach((node) => deleteNode(node.id))
    },
    [deleteNode],
  )

  const onEdgesDelete = useCallback(
    (deletedEdges: { id: string }[]) => {
      deletedEdges.forEach((edge) => disconnectEdge(edge.id))
    },
    [disconnectEdge],
  )

  const onSelectionChange = useCallback(
    ({
      nodes: selectedNodes,
      edges: selectedEdges,
    }: {
      nodes: { id: string }[]
      edges: { id: string }[]
    }) => {
      setSelectedNodeIds(selectedNodes.map((node) => node.id))
      setSelectedEdgeId(
        selectedEdges.length === 1 ? selectedEdges[0].id : null,
      )
    },
    [setSelectedNodeIds, setSelectedEdgeId],
  )

  const onNodeDragStart = useCallback(() => {
    pushHistory()
  }, [pushHistory])

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        selectable: true,
        focusable: true,
      })),
    [edges],
  )

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'smoothstep',
      animated: true,
      interactionWidth: isMobile ? 32 : 24,
      style: { stroke: '#64748b', strokeWidth: 2 },
    }),
    [isMobile],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={styledEdges}
      nodeTypes={nodeTypes}
      viewport={viewport}
      onViewportChange={setViewport}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onNodeDragStart={onNodeDragStart}
      onSelectionChange={onSelectionChange}
      defaultEdgeOptions={defaultEdgeOptions}
      nodesDraggable={!readOnlyMode}
      nodesConnectable={!readOnlyMode}
      elementsSelectable={!readOnlyMode}
      edgesFocusable={!readOnlyMode}
      edgesReconnectable={false}
      deleteKeyCode={readOnlyMode ? null : ['Backspace', 'Delete']}
      multiSelectionKeyCode={readOnlyMode ? null : 'Shift'}
      panOnDrag
      selectionOnDrag={!readOnlyMode}
      connectionLineStyle={{ stroke: '#a78bfa', strokeWidth: 2 }}
      colorMode="dark"
      proOptions={{ hideAttribution: true }}
      zoomOnPinch
      panOnScroll={!isMobile}
      preventScrolling={isMobile}
      minZoom={0.15}
      maxZoom={2}
    >
      <Background gap={16} size={1} />
      <MiniMap
        position="top-right"
        nodeColor="#334155"
        maskColor="rgba(15, 23, 42, 0.75)"
        className="!bg-slate-900 !hidden md:!block"
        pannable
        zoomable
      />
      <FitViewOnGraphChange />
    </ReactFlow>
  )
}

interface CanvasProps {
  onOpenSidebar: () => void
}

export function Canvas({ onOpenSidebar }: CanvasProps) {
  const isMobile = useIsMobile()
  const readOnlyMode = useConversationStore((state) => state.readOnlyMode)
  const activeProject = useConversationStore((state) =>
    state.projects.find((project) => project.id === state.activeProjectId),
  )

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {isMobile && (
        <header className="safe-top flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/95 px-3 py-2.5">
          <button
            type="button"
            aria-label={`打开 ${PRODUCT_NAME} 项目列表`}
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100">
              {PRODUCT_NAME}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {activeProject?.name ?? '未命名项目'}
              {readOnlyMode ? ' · 阅读' : ''}
            </p>
          </div>
        </header>
      )}

      <div className="relative min-h-0 flex-1 touch-pan-x touch-pan-y">
        <ReactFlowProvider>
          <CanvasInner />
          <CanvasToolbar />
          <BlockFab />
        </ReactFlowProvider>
      </div>
    </div>
  )
}
