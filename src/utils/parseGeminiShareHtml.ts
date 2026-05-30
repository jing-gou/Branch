import type { ChatFlowEdge, ChatFlowNode } from '../types/conversation'
import { DEFAULT_NODE_WIDTH, EDGE_TYPE } from '../lib/constants'
import { createEdgeId, createMessageId } from './ids'
import { estimateMergedNodeHeight } from './nodeContentHeight'
import { createChatMessage, createSingleNodeData } from './nodeMessages'

export interface GeminiTurn {
  userContent: string
  assistantContent: string
}

export interface GeminiShareParseResult {
  title: string
  turns: GeminiTurn[]
}

const GEMINI_SHARE_URL_RE =
  /^https?:\/\/(?:gemini\.google\.com|www\.gemini\.google\.com)\/share\/[a-zA-Z0-9_-]+/i

export function isGeminiShareUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    return GEMINI_SHARE_URL_RE.test(parsed.origin + parsed.pathname)
  } catch {
    return false
  }
}

export function normalizeGeminiShareUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('请输入 Gemini 分享链接')
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  const parsed = new URL(withProtocol)
  if (!isGeminiShareUrl(parsed.href)) {
    throw new Error(
      '链接格式无效，应为 https://gemini.google.com/share/xxxx',
    )
  }
  return parsed.href
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function htmlToPlainText(html: string): string {
  let text = html
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (_, code) => {
    const body = decodeHtmlEntities(code.replace(/<[^>]+>/g, ''))
    return `\n\`\`\`\n${body}\n\`\`\`\n`
  })
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => {
    const body = decodeHtmlEntities(code.replace(/<[^>]+>/g, ''))
    return `\`${body}\``
  })
  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => {
    const hashes = '#'.repeat(Math.min(6, Number(level)))
    return `\n${hashes} ${decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').trim())}\n`
  })
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const line = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').trim())
    return line ? `\n- ${line}` : ''
  })
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<[^>]+>/g, '')
  text = decodeHtmlEntities(text)
  return text.replace(/\n{3,}/g, '\n\n').trim()
}

function extractPageTitle(html: string): string {
  const ogTitle = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
  )
  if (ogTitle?.[1]) return decodeHtmlEntities(ogTitle[1].trim())

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (title?.[1]) {
    const raw = title[1].replace(/<[^>]+>/g, '').trim()
    if (raw && !/^gemini$/i.test(raw)) return decodeHtmlEntities(raw)
  }

  return 'Gemini 对话'
}

function sanitizeTitle(title: string): string {
  return title.replace(/^[\u200B-\u200D\uFEFF\u00A0]+/g, '').trim()
}

function extractUserQuery(userQueryHtml: string): string {
  const lines: string[] = []
  const linePattern =
    /<p[^>]*class="[^"]*query-text-line[^"]*"[^>]*>([\s\S]*?)<\/p>/gi

  for (const match of userQueryHtml.matchAll(linePattern)) {
    const line = htmlToPlainText(match[1])
    if (line) lines.push(line)
  }

  if (lines.length > 0) return lines.join('\n').trim()

  const queryText = userQueryHtml.match(
    /<div[^>]*class="[^"]*query-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  )
  return queryText ? htmlToPlainText(queryText[1]) : ''
}

function extractAssistantResponse(responseHtml: string): string {
  const messageContent = responseHtml.match(
    /<message-content[^>]*>([\s\S]*?)<\/message-content>/i,
  )
  if (messageContent?.[1]) {
    return htmlToPlainText(messageContent[1])
  }

  const structured = responseHtml.match(
    /<structured-content-container[^>]*>([\s\S]*?)<\/structured-content-container>/i,
  )
  if (structured?.[1]) {
    return htmlToPlainText(structured[1])
  }

  return htmlToPlainText(responseHtml)
}

export function parseGeminiShareHtml(html: string): GeminiShareParseResult {
  if (!html.trim()) {
    throw new Error('页面内容为空')
  }

  if (!html.includes('share-turn-viewer') && !html.includes('user-query')) {
    throw new Error(
      'HTML 中未找到 Gemini 分享对话。若来自链接拉取，请确认 Playwright 已安装（npm run setup:browser）。',
    )
  }

  const title = sanitizeTitle(extractPageTitle(html))
  const turns: GeminiTurn[] = []

  const turnBlocks = [
    ...html.matchAll(/<share-turn-viewer[^>]*>([\s\S]*?)<\/share-turn-viewer>/gi),
  ]

  if (turnBlocks.length === 0) {
    throw new Error(
      '未识别到对话内容。请确认链接为 Gemini 公开分享页，或尝试保存完整网页后粘贴 HTML。',
    )
  }

  for (const [, block] of turnBlocks) {
    const userHtml = block.match(/<user-query[\s\S]*?<\/user-query>/i)?.[0]
    const responseHtml = block.match(
      /<response-container[\s\S]*?<\/response-container>/i,
    )?.[0]

    const userContent = userHtml ? extractUserQuery(userHtml) : ''
    const assistantContent = responseHtml
      ? extractAssistantResponse(responseHtml)
      : ''

    if (!userContent.trim() && !assistantContent.trim()) continue

    turns.push({ userContent, assistantContent })
  }

  if (turns.length === 0) {
    throw new Error('分享页中没有可提取的问答内容')
  }

  return { title, turns }
}

export function geminiTurnsToFlowGraph(turns: GeminiTurn[]): {
  nodes: ChatFlowNode[]
  edges: ChatFlowEdge[]
} {
  const nodes: ChatFlowNode[] = []
  const edges: ChatFlowEdge[] = []
  let previousId: string | null = null

  for (const turn of turns) {
    const user = turn.userContent.trim()
    const assistant = turn.assistantContent.trim()

    if (user && assistant) {
      const id = createMessageId()
      const qMsg = createChatMessage('user', user)
      const aMsg = createChatMessage('assistant', assistant)
      const width = DEFAULT_NODE_WIDTH
      nodes.push({
        id,
        type: 'chatNode',
        position: { x: 0, y: 0 },
        data: {
          messages: [qMsg, aMsg],
          width,
          height: estimateMergedNodeHeight([qMsg, aMsg], width),
        },
      })

      if (previousId) {
        edges.push({
          id: createEdgeId(previousId, id),
          source: previousId,
          target: id,
          type: EDGE_TYPE,
        })
      }
      previousId = id
      continue
    }

    const role = user ? 'user' : 'assistant'
    const content = user || assistant
    const id = createMessageId()
    nodes.push({
      id,
      type: 'chatNode',
      position: { x: 0, y: 0 },
      data: createSingleNodeData(role, content),
    })
    if (previousId) {
      edges.push({
        id: createEdgeId(previousId, id),
        source: previousId,
        target: id,
        type: EDGE_TYPE,
      })
    }
    previousId = id
  }

  return { nodes, edges }
}
