import type { Viewport } from '@xyflow/react'
import type {
  ChatFlowEdge,
  ChatFlowNode,
  LayoutDirection,
} from './conversation'

export interface Project {
  id: string
  name: string
  updatedAt: string
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
  layoutDirection: LayoutDirection
}

export interface GraphSnapshot {
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
  viewport: Viewport
  layoutDirection: LayoutDirection
  selectedNodeId: string | null
}

export interface WorkspaceStorage {
  version: 2
  activeProjectId: string
  projects: Project[]
}
