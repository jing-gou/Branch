import { useCallback, useRef, useState } from 'react'
import { FolderPlus, Link2, Plus } from 'lucide-react'
import { useConversationStore } from '../../store/conversationStore'
import {
  downloadConversationJson,
  parseConversationJson,
  serializeConversation,
} from '../../utils/persistence'
import { GeminiImportDialog } from './GeminiImportDialog'
import { ProjectContextMenu } from './ProjectContextMenu'
import { PRODUCT_NAME } from '../../lib/brand'

const LONG_PRESS_MS = 500

interface ProjectSidebarProps {
  onNavigate?: () => void
}

export function ProjectSidebar({ onNavigate }: ProjectSidebarProps) {
  const projects = useConversationStore((state) => state.projects)
  const activeProjectId = useConversationStore((state) => state.activeProjectId)
  const nodeCount = useConversationStore((state) => state.nodes.length)
  const createProject = useConversationStore((state) => state.createProject)
  const switchProject = useConversationStore((state) => state.switchProject)
  const renameProject = useConversationStore((state) => state.renameProject)
  const deleteProject = useConversationStore((state) => state.deleteProject)
  const resetGraph = useConversationStore((state) => state.resetGraph)
  const hydrate = useConversationStore((state) => state.hydrate)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [menu, setMenu] = useState<{
    projectId: string
    x: number
    y: number
  } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [geminiImportOpen, setGeminiImportOpen] = useState(false)

  const openMenu = useCallback((projectId: string, x: number, y: number) => {
    setMenu({ projectId, x, y })
  }, [])

  const closeMenu = useCallback(() => setMenu(null), [])

  const menuProject = menu
    ? projects.find((project) => project.id === menu.projectId)
    : null

  const handleExport = () => {
    const state = useConversationStore.getState()
    downloadConversationJson(
      serializeConversation({
        nodes: state.nodes,
        edges: state.edges,
        viewport: state.viewport,
        layoutDirection: state.layoutDirection,
      }),
    )
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const saved = parseConversationJson(String(reader.result))
        hydrate(saved)
      } catch (importError) {
        window.alert(
          importError instanceof Error
            ? importError.message
            : '导入失败',
        )
      } finally {
        event.target.value = ''
      }
    }
    reader.readAsText(file)
  }

  const startRename = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return
    setRenamingId(projectId)
    setRenameValue(project.name)
    closeMenu()
  }

  const commitRename = () => {
    if (!renamingId) return
    renameProject(renamingId, renameValue)
    setRenamingId(null)
  }

  const handleDeleteProject = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return
    if (projects.length === 1) {
      window.alert('至少需要保留一个项目。')
      return
    }
    if (!window.confirm(`确定删除项目「${project.name}」？`)) return
    deleteProject(projectId)
  }

  const handleClearCanvas = () => {
    if (nodeCount === 0) return
    if (!window.confirm('清空当前项目的画布？')) return
    resetGraph()
  }

  const bindLongPress = (projectId: string) => ({
    onTouchStart: (event: React.TouchEvent) => {
      const touch = event.touches[0]
      longPressTimer.current = setTimeout(() => {
        openMenu(projectId, touch.clientX, touch.clientY)
      }, LONG_PRESS_MS)
    },
    onTouchEnd: () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    },
    onTouchMove: () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    },
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-white">
            {PRODUCT_NAME}
          </h1>
          <p className="text-[10px] text-slate-500">项目</p>
        </div>
        <div className="flex gap-0.5">
          <button
            type="button"
            onClick={() => setGeminiImportOpen(true)}
            title="从 Gemini 分享导入"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-violet-300"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => createProject()}
            title="新建项目"
            className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <FolderPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ul className="ui-scroll flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {projects.map((project) => {
          const isActive = project.id === activeProjectId
          const isRenaming = renamingId === project.id

          return (
            <li key={project.id}>
              {isRenaming ? (
                <div className="px-1 py-1">
                  <input
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    className="w-full rounded-md border border-violet-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-100 focus:outline-none"
                    autoFocus
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename()
                      if (event.key === 'Escape') setRenamingId(null)
                    }}
                    onBlur={commitRename}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    switchProject(project.id)
                    onNavigate?.()
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    openMenu(project.id, event.clientX, event.clientY)
                  }}
                  {...bindLongPress(project.id)}
                  className={`w-full rounded-md px-3 py-2.5 text-left text-sm transition ${
                    isActive
                      ? 'bg-violet-600/20 font-medium text-violet-200'
                      : 'text-slate-300 hover:bg-slate-800/80'
                  }`}
                >
                  <span className="line-clamp-2">{project.name}</span>
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => createProject()}
        className="mx-2 mb-2 inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2 text-xs text-slate-500 transition hover:border-slate-600 hover:text-slate-300"
      >
        <Plus className="h-3.5 w-3.5" />
        新建项目
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleImport}
      />

      <GeminiImportDialog
        open={geminiImportOpen}
        onClose={() => setGeminiImportOpen(false)}
      />

      {menu && menuProject && (
        <ProjectContextMenu
          x={menu.x}
          y={menu.y}
          projectName={menuProject.name}
          onClose={closeMenu}
          onRename={() => startRename(menu.projectId)}
          onExport={handleExport}
          onImport={() => fileInputRef.current?.click()}
          onImportGemini={() => {
            closeMenu()
            setGeminiImportOpen(true)
          }}
          onClearCanvas={handleClearCanvas}
          onDelete={() => handleDeleteProject(menu.projectId)}
          canDelete={projects.length > 1}
          canClear={nodeCount > 0}
        />
      )}
    </div>
  )
}
