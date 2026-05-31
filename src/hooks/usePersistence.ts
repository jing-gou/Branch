import { useEffect, useRef } from 'react'
import { useConversationStore } from '../store/conversationStore'
import {
  buildWorkspaceFromState,
  loadWorkspace,
  saveWorkspace,
} from '../utils/persistence'
import { loadWebDavConfig } from '../utils/webdavConfig'
import { syncWorkspaceWithWebDav } from '../utils/webdavSync'

const AUTOSAVE_MS = 800
const WEBDAV_AUTOSAVE_MS = 2000

export function usePersistence() {
  const hydrated = useRef(false)
  const localTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const webdavTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const bootstrap = async () => {
      const config = loadWebDavConfig()
      let workspace = loadWorkspace()

      if (config.enabled && config.autoSync && config.url && config.username) {
        try {
          const result = await syncWorkspaceWithWebDav(config, workspace)
          if (result.action !== 'noop' && result.envelope) {
            workspace = result.envelope.workspace
          }
        } catch {
          // Keep local workspace if remote sync fails on startup.
        }
      }

      useConversationStore.getState().hydrateWorkspace(workspace)
      hydrated.current = true
    }

    void bootstrap()
  }, [])

  useEffect(() => {
    const unsubscribe = useConversationStore.subscribe((state) => {
      if (!hydrated.current) return

      if (localTimer.current) clearTimeout(localTimer.current)
      localTimer.current = setTimeout(() => {
        const workspace = buildWorkspaceFromState({
          activeProjectId: state.activeProjectId,
          projects: state.projects,
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
          layoutDirection: state.layoutDirection,
        })
        saveWorkspace(workspace)
        useConversationStore.setState({
          lastSavedAt: Date.now(),
          projects: workspace.projects,
        })
      }, AUTOSAVE_MS)

      const config = loadWebDavConfig()
      if (!config.enabled || !config.autoSync || !config.url || !config.username) {
        return
      }

      if (webdavTimer.current) clearTimeout(webdavTimer.current)
      webdavTimer.current = setTimeout(() => {
        const workspace = buildWorkspaceFromState({
          activeProjectId: state.activeProjectId,
          projects: state.projects,
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
          layoutDirection: state.layoutDirection,
        })

        void syncWorkspaceWithWebDav(config, workspace)
          .then((result) => {
            if (result.action === 'noop' || !result.envelope) return
            const merged = result.envelope.workspace
            const state = useConversationStore.getState()
            const previousIds = state.projects
              .map((project) => project.id)
              .sort()
              .join(',')
            const mergedIds = merged.projects
              .map((project) => project.id)
              .sort()
              .join(',')
            if (previousIds !== mergedIds) {
              state.hydrateWorkspace(merged)
              return
            }
            useConversationStore.setState({ projects: merged.projects })
          })
          .catch(() => {
            // Silent fail for background auto upload; user can use manual sync UI.
          })
      }, WEBDAV_AUTOSAVE_MS)
    })

    return () => {
      unsubscribe()
      if (localTimer.current) clearTimeout(localTimer.current)
      if (webdavTimer.current) clearTimeout(webdavTimer.current)
    }
  }, [])
}
