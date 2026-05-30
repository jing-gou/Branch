import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { normalizeDisplayMath } from '../../utils/normalizeDisplayMath'

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  if (!content.trim()) {
    return <span className="text-slate-500">(empty)</span>
  }

  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {normalizeDisplayMath(content)}
    </ReactMarkdown>
  )
}
