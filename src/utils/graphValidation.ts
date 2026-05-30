export function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: Array<{ source: string; target: string }>,
): boolean {
  if (sourceId === targetId) return true

  const visited = new Set<string>()
  const stack = [targetId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === sourceId) return true
    if (visited.has(current)) continue
    visited.add(current)

    edges
      .filter((edge) => edge.source === current)
      .forEach((edge) => stack.push(edge.target))
  }

  return false
}
