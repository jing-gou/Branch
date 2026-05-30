import dagre from 'dagre'
import { Position } from '@xyflow/react'
import type { ChatFlowEdge, ChatFlowNode, LayoutDirection } from '../types/conversation'
import { getNodeDimensions } from './nodeMessages'

export { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../lib/constants'

export function layoutTree(
  nodes: ChatFlowNode[],
  edges: ChatFlowEdge[],
  direction: LayoutDirection,
): ChatFlowNode[] {
  if (nodes.length === 0) return nodes

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: direction,
    nodesep: direction === 'LR' ? 80 : 60,
    ranksep: direction === 'LR' ? 100 : 80,
  })

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node)
    graph.setNode(node.id, { width, height })
  })

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target)
  })

  dagre.layout(graph)

  const sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom
  const targetPosition = direction === 'LR' ? Position.Left : Position.Top

  return nodes.map((node) => {
    const layoutNode = graph.node(node.id)
    const { width, height } = getNodeDimensions(node)

    return {
      ...node,
      position: {
        x: layoutNode.x - width / 2,
        y: layoutNode.y - height / 2,
      },
      sourcePosition,
      targetPosition,
    }
  })
}
