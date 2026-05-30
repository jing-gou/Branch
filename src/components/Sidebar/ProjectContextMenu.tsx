import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Download,
  Eraser,
  Link2,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react'

export interface ProjectMenuAction {
  id: string
  label: string
  icon: typeof Download
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

interface ProjectContextMenuProps {
  x: number
  y: number
  projectName: string
  onClose: () => void
  onRename: () => void
  onExport: () => void
  onImport: () => void
  onImportGemini: () => void
  onClearCanvas: () => void
  onDelete: () => void
  canDelete: boolean
  canClear: boolean
}

export function ProjectContextMenu({
  x,
  y,
  projectName,
  onClose,
  onRename,
  onExport,
  onImport,
  onImportGemini,
  onClearCanvas,
  onDelete,
  canDelete,
  canClear,
}: ProjectContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) return

    const rect = menu.getBoundingClientRect()
    const pad = 8
    let left = x
    let top = y

    if (left + rect.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - rect.width - pad)
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - rect.height - pad)
    }
    if (left < pad) left = pad
    if (top < pad) top = pad

    setPosition({ left, top })
  }, [x, y])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return
      onClose()
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const actions: ProjectMenuAction[] = [
    {
      id: 'rename',
      label: '重命名',
      icon: Pencil,
      onClick: onRename,
    },
    {
      id: 'export',
      label: '导出 JSON',
      icon: Download,
      onClick: onExport,
    },
    {
      id: 'import',
      label: '导入 JSON',
      icon: Upload,
      onClick: onImport,
    },
    {
      id: 'gemini',
      label: '从 Gemini 分享导入…',
      icon: Link2,
      onClick: onImportGemini,
    },
    {
      id: 'clear',
      label: '清空画布',
      icon: Eraser,
      disabled: !canClear,
      onClick: onClearCanvas,
    },
    {
      id: 'delete',
      label: '删除项目',
      icon: Trash2,
      danger: true,
      disabled: !canDelete,
      onClick: onDelete,
    },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[168px] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
      style={{ left: position.left, top: position.top }}
      role="menu"
    >
      <p className="truncate px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {projectName}
      </p>
      <div className="my-1 border-t border-slate-800" />
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            disabled={action.disabled}
            onClick={() => {
              action.onClick()
              onClose()
            }}
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
              action.danger
                ? 'text-red-400 hover:bg-red-950/50'
                : 'text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-70" />
            {action.label}
          </button>
        )
      })}
    </div>
  )
}
