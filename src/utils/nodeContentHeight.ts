import {
  DEFAULT_NODE_HEIGHT,
  DEFAULT_NODE_WIDTH,
  MAX_NODE_HEIGHT,
  MIN_NODE_HEIGHT,
} from '../lib/constants'
import type { ChatMessage } from '../types/conversation'

const SECTION_CHROME = 36
const DIVIDER_HEIGHT = 1
const HINT_HEIGHT = 18
const LINE_HEIGHT = 19.5
const CHAR_WIDTH = 6.8
const HORIZONTAL_PADDING = 24

function estimateTextHeight(content: string, width: number): number {
  const innerWidth = Math.max(120, width - HORIZONTAL_PADDING)
  const charsPerLine = Math.max(12, Math.floor(innerWidth / CHAR_WIDTH))

  if (!content.trim()) {
    return SECTION_CHROME + LINE_HEIGHT
  }

  const lines = content.split('\n').reduce((total, line) => {
    const trimmed = line.trim()
    if (!trimmed) return total + 1
    return total + Math.max(1, Math.ceil(line.length / charsPerLine))
  }, 0)

  return SECTION_CHROME + lines * LINE_HEIGHT
}

export function estimateSectionHeight(content: string, width: number): number {
  return Math.ceil(estimateTextHeight(content, width))
}

export function estimateMergedNodeHeight(
  messages: ChatMessage[],
  width = DEFAULT_NODE_WIDTH,
  options?: { includeHint?: boolean },
): number {
  const sections = messages.reduce(
    (sum, message) => sum + estimateSectionHeight(message.content, width),
    0,
  )
  const divider = messages.length > 1 ? DIVIDER_HEIGHT : 0
  const hint = options?.includeHint ? HINT_HEIGHT : 0
  const total = sections + divider + hint

  return Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT * 2, Math.ceil(total)))
}

export function estimateSingleNodeHeight(
  content: string,
  width = DEFAULT_NODE_WIDTH,
): number {
  const body = estimateSectionHeight(content, width) + HINT_HEIGHT
  return Math.min(MAX_NODE_HEIGHT, Math.max(MIN_NODE_HEIGHT, Math.ceil(body)))
}

export function estimateNodeHeightFromMessages(
  messages: ChatMessage[],
  width = DEFAULT_NODE_WIDTH,
): number {
  if (messages.length >= 2) {
    return estimateMergedNodeHeight(messages, width)
  }
  if (messages.length === 1) {
    return estimateSingleNodeHeight(messages[0].content, width) || DEFAULT_NODE_HEIGHT
  }
  return DEFAULT_NODE_HEIGHT
}
