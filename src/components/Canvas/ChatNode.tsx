import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react'
import { Trash2 } from 'lucide-react'
import {
  MAX_NODE_HEIGHT,
  MAX_NODE_WIDTH,
  MIN_NODE_HEIGHT,
  MIN_NODE_WIDTH,
} from '../../lib/constants'
import type { ChatMessage, ChatNodeData } from '../../types/conversation'
import { useConversationStore } from '../../store/conversationStore'
import { estimateMergedNodeHeight } from '../../utils/nodeContentHeight'
import {
  defaultNodeDimensions,
  getNodeMessages,
  isMergedNode,
} from '../../utils/nodeMessages'
import { MarkdownContent } from './MarkdownContent'

interface MessageSectionProps {
  nodeId: string
  message: ChatMessage
  messageIndex: number
  selected: boolean
  fitContent?: boolean
}

function MessageSection({
  nodeId,
  message,
  messageIndex,
  selected,
  fitContent = false,
}: MessageSectionProps) {
  const updateMessage = useConversationStore((state) => state.updateMessage)
  const editingTarget = useConversationStore((state) => state.editingTarget)
  const clearEditingTarget = useConversationStore((state) => state.clearEditingTarget)
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (
      editingTarget?.nodeId === nodeId &&
      editingTarget.messageIndex === messageIndex
    ) {
      setIsEditing(true)
      clearEditingTarget()
    }
  }, [clearEditingTarget, editingTarget, messageIndex, nodeId])

  useEffect(() => {
    if (!isEditing) {
      setEditContent(message.content)
    }
  }, [message.content, isEditing])

  useLayoutEffect(() => {
    if (!isEditing || !textareaRef.current) return
    const textarea = textareaRef.current
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [editContent, isEditing])

  const saveEdit = useCallback(() => {
    updateMessage(nodeId, editContent, messageIndex)
    setIsEditing(false)
  }, [editContent, messageIndex, nodeId, updateMessage])

  const cancelEdit = useCallback(() => {
    setEditContent(message.content)
    setIsEditing(false)
  }, [message.content])

  const sectionClass = isUser
    ? 'border-sky-700/80 bg-sky-950/90'
    : 'border-violet-700/80 bg-violet-950/90'
  const labelClass = isUser ? 'text-sky-400' : 'text-violet-400'

  const layoutClass = fitContent ? 'shrink-0' : 'min-h-0 flex-1'
  const contentClass = fitContent
    ? ''
    : 'chat-scroll min-h-0 flex-1 overflow-y-auto'

  return (
    <div
      className={`flex flex-col px-3 py-2 ${sectionClass} ${layoutClass}`}
      onDoubleClick={(event) => {
        event.stopPropagation()
        setIsEditing(true)
      }}
    >
      <div
        className={`mb-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide ${labelClass}`}
      >
        {isUser ? 'User Q' : 'LLM A'}
      </div>

      {isEditing ? (
        <textarea
          ref={textareaRef}
          className="nodrag nowheel gemini-type-code resize-none overflow-hidden rounded border border-slate-600 bg-slate-900/80 p-2 text-slate-200 focus:border-violet-500 focus:outline-none"
          value={editContent}
          rows={1}
          autoFocus
          onChange={(event) => setEditContent(event.target.value)}
          onBlur={saveEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault()
              saveEdit()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              cancelEdit()
            }
          }}
        />
      ) : (
        <div
          className={`chat-markdown ${contentClass}`}
        >
          <MarkdownContent content={message.content} />
        </div>
      )}

      {selected && !isEditing && (
        <p className="mt-1 shrink-0 text-[10px] text-slate-600">
          双击编辑此段
        </p>
      )}
    </div>
  )
}

function useMergedAutoHeight(
  enabled: boolean,
  nodeId: string,
  width: number,
  messages: ChatMessage[],
  selected: boolean,
  storedHeight?: number,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const updateNodeSize = useConversationStore((state) => state.updateNodeSize)
  const contentKey = messages.map((message) => message.content).join('\0')
  const estimated = estimateMergedNodeHeight(messages, width, {
    includeHint: selected,
  })
  const [height, setHeight] = useState(storedHeight ?? estimated)
  const [overflows, setOverflows] = useState(
    (storedHeight ?? estimated) >= MAX_NODE_HEIGHT,
  )

  useLayoutEffect(() => {
    if (!enabled) return

    const el = containerRef.current
    if (!el) return

    const sync = () => {
      const natural = Math.ceil(el.scrollHeight)
      const isOverflowing = natural > MAX_NODE_HEIGHT
      const next = isOverflowing
        ? MAX_NODE_HEIGHT
        : Math.max(MIN_NODE_HEIGHT * 2, natural)

      setHeight(next)
      setOverflows(isOverflowing)

      const node = useConversationStore
        .getState()
        .nodes.find((item) => item.id === nodeId)
      const currentHeight = node?.data.height
      const currentWidth = node?.data.width ?? width

      if (
        currentHeight !== next ||
        (currentWidth !== width && Math.abs(currentWidth - width) > 1)
      ) {
        updateNodeSize(nodeId, width, next)
      }
    }

    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [contentKey, enabled, nodeId, selected, updateNodeSize, width])

  return { containerRef, height, overflows }
}

export function ChatNode({ id, data, selected }: NodeProps) {
  const nodeData = data as ChatNodeData
  const messages = getNodeMessages(nodeData)
  const merged = isMergedNode(nodeData)
  const defaults = defaultNodeDimensions()
  const width = nodeData.width ?? defaults.width
  const singleHeight = nodeData.height ?? defaults.height

  const mergedAuto = useMergedAutoHeight(
    merged,
    id,
    width,
    messages,
    selected ?? false,
    merged ? nodeData.height : undefined,
  )

  const layoutDirection = useConversationStore((state) => state.layoutDirection)
  const updateNodeSize = useConversationStore((state) => state.updateNodeSize)
  const pushHistory = useConversationStore((state) => state.pushHistory)
  const deleteNode = useConversationStore((state) => state.deleteNode)

  const height = merged ? mergedAuto.height : singleHeight

  const targetPosition =
    layoutDirection === 'LR' ? Position.Left : Position.Top
  const sourcePosition =
    layoutDirection === 'LR' ? Position.Right : Position.Bottom

  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation()
      deleteNode(id)
    },
    [deleteNode, id],
  )

  const handleResizeStart = useCallback(() => {
    pushHistory()
  }, [pushHistory])

  const handleResize = useCallback(
    (_event: unknown, params: { width: number; height: number }) => {
      updateNodeSize(id, params.width, params.height)
    },
    [id, updateNodeSize],
  )

  const singleMessage = messages[0]
  const isUser = singleMessage?.role === 'user'
  const borderClass = merged
    ? 'border-slate-600 bg-slate-950/90'
    : isUser
      ? 'border-sky-700 bg-sky-950/90'
      : 'border-violet-700 bg-violet-950/90'

  const minHeight = merged
    ? Math.min(mergedAuto.height, MIN_NODE_HEIGHT * 2)
    : MIN_NODE_HEIGHT

  return (
    <>
      <NodeResizer
        minWidth={MIN_NODE_WIDTH}
        minHeight={minHeight}
        maxWidth={MAX_NODE_WIDTH}
        maxHeight={MAX_NODE_HEIGHT}
        isVisible={selected}
        onResizeStart={handleResizeStart}
        onResize={handleResize}
        onResizeEnd={handleResize}
        lineClassName="!border-violet-500/80"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-violet-400 !bg-violet-300/90"
      />

      <div
        ref={merged ? mergedAuto.containerRef : undefined}
        style={{
          width,
          height: merged
            ? mergedAuto.overflows
              ? mergedAuto.height
              : undefined
            : height,
          maxHeight: merged && mergedAuto.overflows ? MAX_NODE_HEIGHT : undefined,
        }}
        className={`relative flex flex-col rounded-lg border shadow-sm ${borderClass} ${
          merged
            ? mergedAuto.overflows
              ? 'chat-scroll overflow-y-auto'
              : 'h-auto'
            : 'overflow-hidden'
        } ${selected ? 'ring-2 ring-violet-400/80' : ''}`}
      >
        <Handle
          type="target"
          position={targetPosition}
          className="!bg-slate-400"
        />

        {selected && (
          <button
            type="button"
            onClick={handleDelete}
            title="删除块及子树"
            className="nodrag nopan absolute -right-2 -top-2 z-10 rounded-full border border-slate-600 bg-slate-800 p-1 text-slate-400 transition hover:border-red-500 hover:bg-red-950 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}

        {merged ? (
          <>
            <MessageSection
              nodeId={id}
              message={messages[0]}
              messageIndex={0}
              selected={selected ?? false}
              fitContent
            />
            <div className="shrink-0 border-t border-slate-600" />
            <MessageSection
              nodeId={id}
              message={messages[1]}
              messageIndex={1}
              selected={selected ?? false}
              fitContent
            />
          </>
        ) : singleMessage ? (
          <MessageSection
            nodeId={id}
            message={singleMessage}
            messageIndex={0}
            selected={selected ?? false}
          />
        ) : null}

        {selected && !merged && (
          <p className="shrink-0 px-3 pb-2 text-[10px] text-slate-600">
            双击编辑 · 拖拽边角调整大小
          </p>
        )}

        <Handle
          type="source"
          position={sourcePosition}
          className="!bg-slate-400"
        />
      </div>
    </>
  )
}
