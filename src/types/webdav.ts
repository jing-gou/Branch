import type { WorkspaceStorage } from './project'
import type { WEBDAV_SYNC_ENVELOPE_VERSION } from '../lib/webdav'

export interface WebDavConfig {
  enabled: boolean
  autoSync: boolean
  url: string
  remotePath: string
  username: string
  password: string
}

export interface WebDavSyncEnvelope {
  version: typeof WEBDAV_SYNC_ENVELOPE_VERSION
  exportedAt: string
  workspace: WorkspaceStorage
}

export type WebDavSyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface WebDavSyncState {
  status: WebDavSyncStatus
  lastSyncAt: number
  lastError: string | null
}
