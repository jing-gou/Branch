import {
  DEFAULT_WEBDAV_REMOTE_PATH,
  WEBDAV_SYNC_FILENAME,
} from '../lib/webdav'
import type { WebDavConfig } from '../types/webdav'
import {
  buildDigestAuthorization,
  parseDigestChallenge,
} from './webdavDigest'

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getlastmodified/>
  </D:prop>
</D:propfind>`

export class WebDavError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'WebDavError'
    this.status = status
  }
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

export function buildWebDavAuth(config: WebDavConfig): string {
  return `Basic ${btoa(`${config.username}:${config.password}`)}`
}

export function buildRemoteDirectoryUrl(config: WebDavConfig): string {
  const base = config.url.trim().replace(/\/+$/, '')
  const path = trimSlashes(config.remotePath || DEFAULT_WEBDAV_REMOTE_PATH)
  return path ? `${base}/${path}` : base
}

export function buildRemoteFileUrl(config: WebDavConfig): string {
  return `${buildRemoteDirectoryUrl(config)}/${WEBDAV_SYNC_FILENAME}`
}

async function webDavFetch(
  url: string,
  config: WebDavConfig,
  init: RequestInit,
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()

  const send = (authorization?: string) => {
    const headers = new Headers(init.headers)
    if (authorization) {
      headers.set('Authorization', authorization)
    }
    return fetch(url, { ...init, headers })
  }

  const readDigestChallenge = (response: Response) =>
    parseDigestChallenge(response.headers.get('www-authenticate'))

  const sendDigest = (challenge: NonNullable<ReturnType<typeof readDigestChallenge>>) =>
    send(
      buildDigestAuthorization(
        method,
        url,
        config.username,
        config.password,
        challenge,
      ),
    )

  try {
    let response = await send(buildWebDavAuth(config))

    if (response.status !== 401) return response

    let challenge = readDigestChallenge(response)
    if (!challenge) {
      const probe = await send(undefined)
      if (probe.status === 401) {
        challenge = readDigestChallenge(probe)
      }
    }

    if (challenge) {
      response = await sendDigest(challenge)
      if (response.status !== 401) return response
      throw new WebDavError('认证失败，请检查用户名或密码', response.status)
    }

    throw new WebDavError(
      'Digest 认证无法完成：浏览器读不到 WWW-Authenticate。请在 Nginx 增加 Access-Control-Expose-Headers: WWW-Authenticate',
      401,
    )
  } catch (error) {
    if (error instanceof WebDavError) throw error
    const message =
      error instanceof Error ? error.message : 'Network request failed'
    throw new WebDavError(
      `无法连接 WebDAV 服务器（可能是 CORS 限制或地址错误）：${message}`,
    )
  }
}

export async function ensureRemoteDirectory(config: WebDavConfig): Promise<void> {
  const base = config.url.trim().replace(/\/+$/, '')
  const segments = trimSlashes(
    config.remotePath || DEFAULT_WEBDAV_REMOTE_PATH,
  ).split('/')

  let currentPath = ''
  for (const segment of segments) {
    currentPath = `${currentPath}/${segment}`
    const url = `${base}${currentPath}`

    const response = await webDavFetch(url, config, { method: 'MKCOL' })
    if (
      response.status === 201 ||
      response.status === 200 ||
      response.status === 405
    ) {
      continue
    }
    if (response.status === 409) {
      continue
    }
    if (response.ok) continue

    throw new WebDavError(
      `创建远程目录失败 (${response.status})`,
      response.status,
    )
  }
}

export async function testWebDavConnection(config: WebDavConfig): Promise<void> {
  const url = config.url.trim().replace(/\/+$/, '')
  const response = await webDavFetch(url, config, {
    method: 'PROPFIND',
    headers: {
      Depth: '0',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: PROPFIND_BODY,
  })

  if (response.status === 401 || response.status === 403) {
    throw new WebDavError('认证失败，请检查用户名或密码', response.status)
  }

  if (!response.ok && response.status !== 404) {
    throw new WebDavError(
      `连接测试失败 (${response.status})`,
      response.status,
    )
  }
}

export async function getRemoteFileText(config: WebDavConfig): Promise<string | null> {
  const url = buildRemoteFileUrl(config)
  const response = await webDavFetch(url, config, { method: 'GET' })

  if (response.status === 404) return null

  if (response.status === 401 || response.status === 403) {
    throw new WebDavError('认证失败，请检查用户名或密码', response.status)
  }

  if (!response.ok) {
    throw new WebDavError(`下载失败 (${response.status})`, response.status)
  }

  return response.text()
}

export async function putRemoteFileText(
  config: WebDavConfig,
  content: string,
): Promise<void> {
  await ensureRemoteDirectory(config)

  const url = buildRemoteFileUrl(config)
  const response = await webDavFetch(url, config, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: content,
  })

  if (response.status === 401 || response.status === 403) {
    throw new WebDavError('认证失败，请检查用户名或密码', response.status)
  }

  if (!response.ok) {
    throw new WebDavError(`上传失败 (${response.status})`, response.status)
  }
}
