import {
  DEFAULT_WEBDAV_REMOTE_PATH,
  LEGACY_WEBDAV_CONFIG_KEY,
  WEBDAV_CONFIG_KEY,
} from '../lib/webdav'
import type { WebDavConfig } from '../types/webdav'

export const defaultWebDavConfig = (): WebDavConfig => ({
  enabled: false,
  autoSync: false,
  url: '',
  remotePath: DEFAULT_WEBDAV_REMOTE_PATH,
  username: '',
  password: '',
})

export function loadWebDavConfig(): WebDavConfig {
  const raw =
    localStorage.getItem(WEBDAV_CONFIG_KEY) ??
    localStorage.getItem(LEGACY_WEBDAV_CONFIG_KEY)
  if (!raw) return defaultWebDavConfig()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return defaultWebDavConfig()

    const data = parsed as Partial<WebDavConfig>
    const config: WebDavConfig = {
      enabled: Boolean(data.enabled),
      autoSync: Boolean(data.autoSync),
      url: typeof data.url === 'string' ? data.url : '',
      remotePath:
        typeof data.remotePath === 'string' && data.remotePath.trim()
          ? data.remotePath === 'ai-chat-tree'
            ? DEFAULT_WEBDAV_REMOTE_PATH
            : data.remotePath.trim()
          : DEFAULT_WEBDAV_REMOTE_PATH,
      username: typeof data.username === 'string' ? data.username : '',
      password: typeof data.password === 'string' ? data.password : '',
    }

    if (!localStorage.getItem(WEBDAV_CONFIG_KEY)) {
      saveWebDavConfig(config)
      localStorage.removeItem(LEGACY_WEBDAV_CONFIG_KEY)
    }

    return config
  } catch {
    return defaultWebDavConfig()
  }
}

export function saveWebDavConfig(config: WebDavConfig): void {
  localStorage.setItem(WEBDAV_CONFIG_KEY, JSON.stringify(config))
}

export function validateWebDavConfig(config: WebDavConfig): string | null {
  if (!config.url.trim()) return '请填写 WebDAV 服务器地址'
  if (!config.username.trim()) return '请填写用户名'

  try {
    const parsed = new URL(config.url.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '服务器地址需以 http:// 或 https:// 开头'
    }
    if (
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      parsed.protocol === 'http:'
    ) {
      return '当前页面为 HTTPS，WebDAV 须使用 https:// 地址，否则浏览器会拦截（混合内容）'
    }
  } catch {
    return '服务器地址格式无效'
  }

  return null
}
