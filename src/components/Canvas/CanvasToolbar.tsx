import {
  ArrowDown,
  ArrowRight,
  GitMerge,
  Redo2,
  Undo2,
  Unlink,
} from 'lucide-react'
import { useConversationStore } from '../../store/conversationStore'
import type { LayoutDirection } from '../../types/conversation'
import { canMergeAsQaPair } from '../../utils/nodeMessages'

export function CanvasToolbar() {
  const layoutDirection = useConversationStore((state) => state.layoutDirection)
  const setLayoutDirection = useConversationStore(
    (state) => state.setLayoutDirection,
  )
  const nodeCount = useConversationStore((state) => state.nodes.length)
  const past = useConversationStore((state) => state.past)
  const future = useConversationStore((state) => state.future)
  const undo = useConversationStore((state) => state.undo)
  const redo = useConversationStore((state) => state.redo)
  const edges = useConversationStore((state) => state.edges)
  const selectedEdgeId = useConversationStore((state) => state.selectedEdgeId)
  const selectedNodeIds = useConversationStore((state) => state.selectedNodeIds)
  const nodes = useConversationStore((state) => state.nodes)
  const disconnectEdge = useConversationStore((state) => state.disconnectEdge)
  const mergeQaNodes = useConversationStore((state) => state.mergeQaNodes)

  const canUndo = past.length > 0
  const canRedo = future.length > 0
  const selectedEdge = selectedEdgeId
    ? edges.find((edge) => edge.id === selectedEdgeId)
    : null

  const mergePair =
    selectedNodeIds.length === 2
      ? canMergeAsQaPair(nodes, selectedNodeIds[0], selectedNodeIds[1])
      : null

  const layoutOptions: Array<{
    direction: LayoutDirection
    label: string
    icon: typeof ArrowDown
  }> = [
    { direction: 'TB', label: '竖向', icon: ArrowDown },
    { direction: 'LR', label: '横向', icon: ArrowRight },
  ]

  const btnClass =
    'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-800 hover:text-slate-100 active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 md:h-9 md:w-9'
  const activeClass = 'bg-violet-600/25 text-violet-300'

  return (
    <div className="pointer-events-auto absolute right-2 bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-2 z-10 flex max-w-[calc(100%-1rem)] justify-start overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-900/95 p-1 shadow-lg backdrop-blur-sm [-webkit-overflow-scrolling:touch] md:right-auto md:bottom-4 md:left-4 md:max-w-none">
      {layoutOptions.map(({ direction, icon: Icon, label }) => (
        <button
          key={direction}
          type="button"
          title={`${label}布局`}
          aria-label={`${label}布局`}
          disabled={nodeCount === 0}
          onClick={() => setLayoutDirection(direction)}
          className={`${btnClass} ${
            layoutDirection === direction ? activeClass : ''
          }`}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}

      <div className="mx-0.5 h-6 w-px shrink-0 self-center bg-slate-700" />

      <button
        type="button"
        title="撤销"
        aria-label="撤销"
        disabled={!canUndo}
        onClick={undo}
        className={btnClass}
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="重做"
        aria-label="重做"
        disabled={!canRedo}
        onClick={redo}
        className={btnClass}
      >
        <Redo2 className="h-4 w-4" />
      </button>

      {selectedEdge && (
        <>
          <div className="mx-0.5 h-6 w-px shrink-0 self-center bg-slate-700" />
          <button
            type="button"
            title="断开选中连线"
            aria-label="断开选中连线"
            onClick={() => disconnectEdge(selectedEdge.id)}
            className={`${btnClass} hover:text-red-300`}
          >
            <Unlink className="h-4 w-4" />
          </button>
        </>
      )}

      {mergePair && (
        <>
          <div className="mx-0.5 h-6 w-px shrink-0 self-center bg-slate-700" />
          <button
            type="button"
            title="合并选中的 Q 与 A"
            aria-label="合并选中的 Q 与 A"
            onClick={() =>
              mergeQaNodes(selectedNodeIds[0], selectedNodeIds[1])
            }
            className={`${btnClass} hover:text-emerald-300`}
          >
            <GitMerge className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
