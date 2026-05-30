import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Cloud, Settings2 } from 'lucide-react'
import { useConversationStore } from '../../store/conversationStore'
import {
  buildWorkspaceFromState,
  saveWorkspace,
} from '../../utils/persistence'
import {
  loadWebDavConfig,
  saveWebDavConfig,
  validateWebDavConfig,
} from '../../utils/webdavConfig'
import {
  pullWorkspaceFromWebDav,
  pushWorkspaceToWebDav,
  syncWorkspaceWithWebDav,
  testWebDavSetup,
  WebDavError,
} from '../../utils/webdavSync'
import type { WebDavConfig } from '../../types/webdav'

export function WebDavSettings() {
  const hydrateWorkspace = useConversationStore((state) => state.hydrateWorkspace)
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<WebDavConfig>(() => loadWebDavConfig())
  const [statusText, setStatusText] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    saveWebDavConfig(config)
  }, [config])

  const updateConfig = useCallback((patch: Partial<WebDavConfig>) => {
    setConfig((current) => ({ ...current, ...patch }))
    setErrorText(null)
  }, [])

  const getCurrentWorkspace = useCallback(() => {
    const state = useConversationStore.getState()
    return buildWorkspaceFromState({
      activeProjectId: state.activeProjectId,
      projects: state.projects,
      nodes: state.nodes,
      edges: state.edges,
      viewport: state.viewport,
      layoutDirection: state.layoutDirection,
    })
  }, [])

  const runAction = useCallback(
    async (action: () => Promise<void>, successMessage: string) => {
      setBusy(true)
      setErrorText(null)
      setStatusText('同步中…')
      try {
        await action()
        setStatusText(successMessage)
      } catch (error) {
        const message =
          error instanceof WebDavError || error instanceof Error
            ? error.message
            : 'WebDAV 操作失败'
        setErrorText(message)
        setStatusText(null)
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  return (
    <div className="shrink-0 border-t border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-3 py-3 text-left text-sm text-slate-300 transition hover:bg-slate-800/50"
      >
        <span className="inline-flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-slate-500" />
          WebDAV 同步
          {config.enabled && (
            <Cloud className="h-3.5 w-3.5 text-violet-400" />
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-500 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-slate-800/80 px-3 pb-3 pt-2">
          <label className="inline-flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => updateConfig({ enabled: event.target.checked })}
              className="rounded border-slate-600 bg-slate-800 text-violet-500"
            />
            启用
          </label>

          <div className={`space-y-2 ${config.enabled ? '' : 'opacity-50'}`}>
            <input
              type="url"
              value={config.url}
              disabled={!config.enabled || busy}
              onChange={(event) => updateConfig({ url: event.target.value })}
              placeholder="WebDAV 地址"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed"
            />
            <input
              type="text"
              value={config.remotePath}
              disabled={!config.enabled || busy}
              onChange={(event) => updateConfig({ remotePath: event.target.value })}
              placeholder="远程目录"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed"
            />
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                value={config.username}
                disabled={!config.enabled || busy}
                onChange={(event) => updateConfig({ username: event.target.value })}
                placeholder="用户名"
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed"
              />
              <input
                type="password"
                value={config.password}
                disabled={!config.enabled || busy}
                onChange={(event) => updateConfig({ password: event.target.value })}
                placeholder="密码"
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-200 focus:border-violet-500 focus:outline-none disabled:cursor-not-allowed"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={config.autoSync}
                disabled={!config.enabled || busy}
                onChange={(event) => updateConfig({ autoSync: event.target.checked })}
                className="rounded border-slate-600 bg-slate-800 text-violet-500"
              />
              保存后自动上传
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={!config.enabled || busy}
                onClick={() =>
                  runAction(async () => {
                    const err = validateWebDavConfig(config)
                    if (err) throw new WebDavError(err)
                    await testWebDavSetup(config)
                  }, '连接成功')
                }
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 hover:border-slate-600 disabled:opacity-40"
              >
                测试
              </button>
              <button
                type="button"
                disabled={!config.enabled || busy}
                onClick={() =>
                  runAction(async () => {
                    const workspace = getCurrentWorkspace()
                    const result = await syncWorkspaceWithWebDav(config, workspace)
                    if (result.action === 'pulled' && result.envelope) {
                      hydrateWorkspace(result.envelope.workspace)
                    }
                    if (result.action === 'pushed') saveWorkspace(workspace)
                  }, '同步完成')
                }
                className="rounded-md border border-violet-700 bg-violet-950 px-2 py-1.5 text-xs text-violet-300 hover:border-violet-500 disabled:opacity-40"
              >
                同步
              </button>
              <button
                type="button"
                disabled={!config.enabled || busy}
                onClick={() =>
                  runAction(async () => {
                    const workspace = getCurrentWorkspace()
                    await pushWorkspaceToWebDav(config, workspace)
                    saveWorkspace(workspace)
                  }, '已上传')
                }
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 disabled:opacity-40"
              >
                上传
              </button>
              <button
                type="button"
                disabled={!config.enabled || busy}
                onClick={() =>
                  runAction(async () => {
                    const remote = await pullWorkspaceFromWebDav(config)
                    if (!remote) throw new WebDavError('远程尚无 workspace.json')
                    saveWorkspace(remote.workspace)
                    hydrateWorkspace(remote.workspace)
                  }, '已拉取')
                }
                className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 disabled:opacity-40"
              >
                拉取
              </button>
            </div>
          </div>

          {statusText && (
            <p className="text-xs text-emerald-400">{statusText}</p>
          )}
          {errorText && (
            <p className="text-xs text-red-400">{errorText}</p>
          )}
        </div>
      )}
    </div>
  )
}
