import { useState } from 'react'
import { Bot, MessagesSquare, Plus, UserRound, X } from 'lucide-react'
import { useIsMobile } from '../../hooks/useMediaQuery'
import { useConversationStore } from '../../store/conversationStore'

export function BlockFab() {
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)
  const addBlock = useConversationStore((state) => state.addBlock)
  const addQaBlock = useConversationStore((state) => state.addQaBlock)

  const fabClass =
    'pointer-events-auto inline-flex items-center justify-center gap-2 rounded-full border text-sm font-medium shadow-lg backdrop-blur-sm transition'

  const mobileActionClass = `${fabClass} h-11 min-w-[11rem] border px-4 py-2.5`
  const desktopFabClass = `${fabClass} px-4 py-2.5`

  const runAndClose = (action: () => void) => {
    action()
    setMenuOpen(false)
  }

  if (isMobile) {
    return (
      <div className="pointer-events-none absolute right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-10 flex flex-col items-end gap-2">
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="添加 Q 块"
              onClick={() => runAndClose(() => addBlock('user'))}
              className={`${mobileActionClass} border-sky-600/80 bg-sky-950/95 text-sky-200`}
            >
              <UserRound className="h-4 w-4" />
              Q 块
            </button>
            <button
              type="button"
              aria-label="添加 A 块"
              onClick={() => runAndClose(() => addBlock('assistant'))}
              className={`${mobileActionClass} border-violet-600/80 bg-violet-950/95 text-violet-200`}
            >
              <Bot className="h-4 w-4" />
              A 块
            </button>
            <button
              type="button"
              aria-label="添加 QA 块"
              onClick={() => runAndClose(() => addQaBlock())}
              className={`${mobileActionClass} border-emerald-600/80 bg-emerald-950/95 text-emerald-200`}
            >
              <MessagesSquare className="h-4 w-4" />
              QA 块
            </button>
          </>
        )}
        <button
          type="button"
          aria-label={menuOpen ? '关闭添加菜单' : '添加对话块'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          className={`${fabClass} h-12 w-12 border-slate-600/80 bg-slate-900/95 text-slate-100 hover:border-slate-500`}
        >
          {menuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute right-4 bottom-4 z-10 flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => addBlock('user')}
        className={`${desktopFabClass} border-sky-600/80 bg-sky-950/95 text-sky-200 hover:border-sky-500 hover:bg-sky-900`}
      >
        <UserRound className="h-4 w-4" />
        Q 块
      </button>
      <button
        type="button"
        onClick={() => addBlock('assistant')}
        className={`${desktopFabClass} border-violet-600/80 bg-violet-950/95 text-violet-200 hover:border-violet-500 hover:bg-violet-900`}
      >
        <Bot className="h-4 w-4" />
        A 块
      </button>
      <button
        type="button"
        onClick={() => addQaBlock()}
        className={`${desktopFabClass} border-emerald-600/80 bg-emerald-950/95 text-emerald-200 hover:border-emerald-500 hover:bg-emerald-900`}
      >
        <MessagesSquare className="h-4 w-4" />
        QA 块
      </button>
    </div>
  )
}
