export const createMessageId = () => `msg_${crypto.randomUUID()}`

export const createEdgeId = (source: string, target: string) =>
  `edge_${source}_${target}`
