export const STORAGE_KEY = 'branch-workspace'
export const LEGACY_STORAGE_KEY = 'ai-chat-tree-canvas'

export const WEBDAV_CONFIG_KEY = 'branch-webdav-config'
export const LEGACY_WEBDAV_CONFIG_KEY = 'ai-chat-tree-webdav-config'

const LEGACY_WEBDAV_REMOTE_PATH = 'ai-chat-tree'

function migrateWebDavConfigPayload(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return raw

    const data = parsed as { remotePath?: string }
    if (data.remotePath === LEGACY_WEBDAV_REMOTE_PATH) {
      return JSON.stringify({ ...data, remotePath: 'branch' })
    }
  } catch {
    // Keep raw payload if JSON is invalid; loader will fall back to defaults.
  }
  return raw
}

function migrateStorageKey(
  nextKey: string,
  legacyKey: string,
  transform?: (raw: string) => string,
): void {
  if (localStorage.getItem(nextKey)) {
    localStorage.removeItem(legacyKey)
    return
  }

  const legacy = localStorage.getItem(legacyKey)
  if (!legacy) return

  localStorage.setItem(nextKey, transform ? transform(legacy) : legacy)
  localStorage.removeItem(legacyKey)
}

/** One-time migration from pre-Branch localStorage keys. */
export function migrateBranchStorageKeys(): void {
  migrateStorageKey(STORAGE_KEY, LEGACY_STORAGE_KEY)
  migrateStorageKey(
    WEBDAV_CONFIG_KEY,
    LEGACY_WEBDAV_CONFIG_KEY,
    migrateWebDavConfigPayload,
  )
}

export function clearBranchStorageKeys(): void {
  for (const key of [
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    WEBDAV_CONFIG_KEY,
    LEGACY_WEBDAV_CONFIG_KEY,
  ]) {
    localStorage.removeItem(key)
  }
}
