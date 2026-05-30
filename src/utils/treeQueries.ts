import type { ChatFlowEdge, ChatFlowNode } from '../types/conversation'

export function getChildEdges(
  nodeId: string,
  edges: ChatFlowEdge[],
): ChatFlowEdge[] {
  return edges.filter((edge) => edge.source === nodeId)
}

export function getChildren(
  nodeId: string,
  edges: ChatFlowEdge[],
  nodes: ChatFlowNode[],
): ChatFlowNode[] {
  const childIds = new Set(getChildEdges(nodeId, edges).map((edge) => edge.target))
  return nodes.filter((node) => childIds.has(node.id))
}

export function getParent(
  nodeId: string,
  edges: ChatFlowEdge[],
  nodes: ChatFlowNode[],
): ChatFlowNode | undefined {
  const parentEdge = edges.find((edge) => edge.target === nodeId)
  if (!parentEdge) return undefined
  return nodes.find((node) => node.id === parentEdge.source)
}

export function collectSubtree(nodeId: string, edges: ChatFlowEdge[]): string[] {
  const descendants: string[] = []
  const stack = getChildEdges(nodeId, edges).map((edge) => edge.target)

  while (stack.length > 0) {
    const current = stack.pop()!
    descendants.push(current)
    getChildEdges(current, edges).forEach((edge) => stack.push(edge.target))
  }

  return descendants
}

export function findRoots(
  edges: ChatFlowEdge[],
  nodes: ChatFlowNode[],
): ChatFlowNode[] {
  const targets = new Set(edges.map((edge) => edge.target))
  return nodes.filter((node) => !targets.has(node.id))
}
