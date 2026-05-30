import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
} from '../lib/constants'
import type { ChatFlowNode, ChatMessage, ChatNodeData, MessageRole } from '../types/conversation'
import { createMessageId } from './ids'
import { estimateNodeHeightFromMessages } from './nodeContentHeight'

export function getNodeMessages(data: ChatNodeData): ChatMessage[] {
  if (data.messages && data.messages.length > 0) {
    return data.messages
  }
  if (data.message) {
    return [data.message]
  }
  return []
}

export function isMergedNode(data: ChatNodeData): boolean {
  return getNodeMessages(data).length >= 2
}

export function createChatMessage(role: MessageRole, content = ''): ChatMessage {
  const id = createMessageId()
  const now = new Date().toISOString()
  return { id, role, content, createdAt: now, updatedAt: now }
}

export function createSingleNodeData(
  role: MessageRole,
  content = '',
  dimensions?: { width?: number; height?: number },
): ChatNodeData {
  const message = createChatMessage(role, content)
  return {
    messages: [message],
    message,
    width: dimensions?.width ?? DEFAULT_NODE_WIDTH,
    height: dimensions?.height ?? DEFAULT_NODE_HEIGHT,
  }
}

export function createMergedNodeData(
  dimensions?: { width?: number; height?: number },
): ChatNodeData {
  const width = dimensions?.width ?? DEFAULT_NODE_WIDTH
  const messages = [
    createChatMessage('user', ''),
    createChatMessage('assistant', ''),
  ]
  return {
    messages,
    width,
    height:
      dimensions?.height ??
      estimateNodeHeightFromMessages(messages, width),
  }
}

export function getNodeDimensions(node: ChatFlowNode) {
  const messages = getNodeMessages(node.data)
  const width = node.data.width ?? DEFAULT_NODE_WIDTH

  return {
    width,
    height:
      node.data.height ??
      estimateNodeHeightFromMessages(messages, width),
  }
}

export function defaultNodeDimensions() {
  return {
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  }
}

export function canMergeAsQaPair(
  nodes: ChatFlowNode[],
  idA: string,
  idB: string,
): { userNode: ChatFlowNode; assistantNode: ChatFlowNode } | null {
  const nodeA = nodes.find((node) => node.id === idA)
  const nodeB = nodes.find((node) => node.id === idB)
  if (!nodeA || !nodeB) return null

  const msgA = getNodeMessages(nodeA.data)[0]
  const msgB = getNodeMessages(nodeB.data)[0]
  if (!msgA || !msgB) return null
  if (isMergedNode(nodeA.data) || isMergedNode(nodeB.data)) return null

  if (msgA.role === 'user' && msgB.role === 'assistant') {
    return { userNode: nodeA, assistantNode: nodeB }
  }
  if (msgA.role === 'assistant' && msgB.role === 'user') {
    return { userNode: nodeB, assistantNode: nodeA }
  }
  return null
}
