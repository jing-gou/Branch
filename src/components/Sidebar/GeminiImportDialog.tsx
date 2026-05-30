import { useCallback, useRef, useState } from 'react'
import { ExternalLink, FileUp, Loader2, X } from 'lucide-react'
import { useConversationStore } from '../../store/conversationStore'
import { normalizeGeminiShareUrl } from '../../utils/parseGeminiShareHtml'

interface GeminiImportDialogProps {
  open: boolean
  onClose: () => void
}

export function GeminiImportDialog({ open, onClose }: GeminiImportDialogProps) {
  const importGeminiAsNewProject = useConversationStore(
    (state) => state.importGeminiAsNewProject,
  )
  const [shareUrl, setShareUrl] = useState('')
  const [pasteHtml, setPasteHtml] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = useCallback(() => {
    setShareUrl('')
    setPasteHtml('')
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (busy) return
    resetForm()
    onClose()
  }, [busy, onClose, resetForm])

  const runImport = useCallback(
    (html: string) => {
      setBusy(true)
      setError(null)
      try {
        importGeminiAsNewProject(html)
        resetForm()
        onClose()
      } catch (importError) {
        setError(
          importError instanceof Error
            ? importError.message
            : '导入失败',
        )
      } finally {
        setBusy(false)
      }
    },
    [importGeminiAsNewProject, onClose, resetForm],
  )

  const handleOpenInBrowser = () => {
    const trimmed = shareUrl.trim()
    if (!trimmed) {
      setError('请先粘贴分享链接')
      return
    }
    try {
      const url = normalizeGeminiShareUrl(trimmed)
      window.open(url, '_blank', 'noopener,noreferrer')
      setError(null)
    } catch (urlError) {
      setError(
        urlError instanceof Error ? urlError.message : '链接格式无效',
      )
    }
  }

  const handleImportPaste = () => {
    if (!pasteHtml.trim()) {
      setError('请粘贴已保存的 Gemini 分享页 HTML')
      return
    }
    runImport(pasteHtml)
  }

  const handleHtmlFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      runImport(String(reader.result ?? ''))
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gemini-import-title"
    >
      <div className="ui-scroll max-h-[min(92dvh,100%)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl sm:max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2
            id="gemini-import-title"
            className="text-sm font-semibold text-white"
          >
            从 Gemini 分享导入
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-xs leading-relaxed text-slate-400">
            Gemini 分享页是对话 SPA，轻量模式下无法从链接直接拉取正文。
            请在浏览器打开分享页，加载完成后{' '}
            <span className="text-slate-300">Ctrl+S 另存为「网页，全部」</span>
            ，再粘贴 HTML 或选择文件导入。
          </p>

          <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-500">
            <li>粘贴下方分享链接，点击「在浏览器打开」</li>
            <li>等待对话完全显示后另存为 HTML</li>
            <li>粘贴到文本框或选择 .html 文件后导入</li>
          </ol>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              value={shareUrl}
              onChange={(event) => {
                setShareUrl(event.target.value)
                setError(null)
              }}
              placeholder="https://gemini.google.com/share/…（可选，用于打开）"
              disabled={busy}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-base text-slate-100 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:opacity-50 sm:text-sm"
            />
            <button
              type="button"
              disabled={busy || !shareUrl.trim()}
              onClick={handleOpenInBrowser}
              title="在浏览器中打开分享页"
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-40 sm:text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打开
            </button>
          </div>

          <textarea
            value={pasteHtml}
            onChange={(event) => {
              setPasteHtml(event.target.value)
              setError(null)
            }}
            disabled={busy}
            placeholder="粘贴另存为的完整 HTML…"
            className="ui-scroll h-32 w-full resize-none rounded-lg border border-slate-700 bg-slate-800 p-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none"
          />

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleImportPaste}
              className="flex-1 rounded-lg bg-violet-600 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : (
                '导入'
              )}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" />
              选文件
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".html,text/html"
        className="hidden"
        onChange={handleHtmlFile}
      />
    </div>
  )
}
