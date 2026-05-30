import { DEFAULT_NODE_WIDTH, EDGE_TYPE } from '../lib/constants'
import type { ChatFlowEdge, ChatFlowNode } from '../types/conversation'
import { createEdgeId, createMessageId } from './ids'
import { estimateMergedNodeHeight } from './nodeContentHeight'
import { getNodeMessages } from './nodeMessages'

export function rewireEdgesForMerge(
  edges: ChatFlowEdge[],
  qNodeId: string,
  aNodeId: string,
  mergedId: string,
): ChatFlowEdge[] {
  const next: ChatFlowEdge[] = []
  const seen = new Set<string>()

  for (const edge of edges) {
    if (edge.source === qNodeId && edge.target === aNodeId) {
      continue
    }

    let source = edge.source
    let target = edge.target

    if (source === qNodeId || source === aNodeId) source = mergedId
    if (target === qNodeId || target === aNodeId) target = mergedId

    if (source === target) continue

    const id = createEdgeId(source, target)
    if (seen.has(id)) continue
    seen.add(id)

    next.push({
      id,
      source,
      target,
      type: EDGE_TYPE,
    })
  }

  return next
}

export function buildMergedNode(
  userNode: ChatFlowNode,
  assistantNode: ChatFlowNode,
): ChatFlowNode {
  const mergedId = createMessageId()
  const qMsg = getNodeMessages(userNode.data)[0]
  const aMsg = getNodeMessages(assistantNode.data)[0]

  const width =
    userNode.data.width ??
    assistantNode.data.width ??
    undefined

  const mergedWidth = width ?? undefined
  const height = estimateMergedNodeHeight(
    [qMsg, aMsg],
    mergedWidth ?? DEFAULT_NODE_WIDTH,
  )

  return {
    id: mergedId,
    type: 'chatNode',
    position: userNode.position,
    data: {
      messages: [qMsg, aMsg],
      width,
      height,
    },
  }
}
