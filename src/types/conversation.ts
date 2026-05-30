import type { Edge, Node, Viewport } from '@xyflow/react'

export type MessageRole = 'user' | 'assistant'

export type LayoutDirection = 'TB' | 'LR'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  updatedAt: string
}

export interface ChatNodeData extends Record<string, unknown> {
  /** @deprecated use messages — kept for backward compatibility */
  message?: ChatMessage
  messages?: ChatMessage[]
  isEditing?: boolean
  width?: number
  height?: number
}

export type ChatFlowNode = Node<ChatNodeData, 'chatNode'>
export type ChatFlowEdge = Edge

export interface ConversationGraph {
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
}

/** Parser output before positions are assigned */
export interface ParsedConversation {
  messages: ChatMessage[]
  links: Array<{ parentId: string | null; childId: string }>
}
