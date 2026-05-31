/**
 * WebDAV connectivity test (Node.js — no browser CORS).
 *
 * Usage:
 *   node scripts/test-webdav.mjs
 *   node scripts/test-webdav.mjs --config webdav.local.json
 *
 * Config file / env (no password in git):
 *   WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS, WEBDAV_REMOTE_PATH (optional, default branch)
 */

import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<D:propfind xmlns:D="DAV:">
  <D:prop><D:displayname/><D:getlastmodified/></D:prop>
</D:propfind>`

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, '')
}

function loadConfig() {
  const configArg = process.argv.includes('--config')
    ? process.argv[process.argv.indexOf('--config') + 1]
    : 'webdav.local.json'

  const configPath = resolve(process.cwd(), configArg)
  if (existsSync(configPath)) {
    const data = JSON.parse(readFileSync(configPath, 'utf8'))
    return {
      url: data.url ?? process.env.WEBDAV_URL,
      username: data.username ?? process.env.WEBDAV_USER,
      password: data.password ?? process.env.WEBDAV_PASS,
      remotePath: data.remotePath ?? process.env.WEBDAV_REMOTE_PATH ?? 'branch',
    }
  }

  return {
    url: process.env.WEBDAV_URL,
    username: process.env.WEBDAV_USER,
    password: process.env.WEBDAV_PASS,
    remotePath: process.env.WEBDAV_REMOTE_PATH ?? 'branch',
  }
}

function authHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

function md5Hex(value) {
  return createHash('md5').update(value).digest('hex')
}

function parseDigestChallenge(wwwAuthenticate) {
  if (!wwwAuthenticate?.match(/^Digest\s+/i)) return null
  const params = {}
  for (const part of wwwAuthenticate.replace(/^Digest\s+/i, '').split(',')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim().toLowerCase()
    let value = trimmed.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1)
    params[key] = value
  }
  if (!params.realm || !params.nonce) return null
  return params
}

function buildDigestAuthorization(method, requestUrl, username, password, challenge) {
  const uri = new URL(requestUrl).pathname + new URL(requestUrl).search
  const ha1 = md5Hex(`${username}:${challenge.realm}:${password}`)
  const ha2 = md5Hex(`${method.toUpperCase()}:${uri}`)
  const cnonce = randomBytes(8).toString('hex')
  const nc = '00000001'
  let response
  if (challenge.qop === 'auth' || challenge.qop === 'auth-int') {
    response = md5Hex(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`)
  } else {
    response = md5Hex(`${ha1}:${challenge.nonce}:${ha2}`)
  }
  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ]
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`)
  if (challenge.qop) {
    parts.push(`qop=${challenge.qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
  }
  return `Digest ${parts.join(', ')}`
}

async function fetchOnce(url, { method, headers, body }) {
  return fetch(url, { method, headers, body, redirect: 'follow' })
}

async function request(
  url,
  { method, headers = {}, body, username, password, withAuth = true },
) {
  const started = Date.now()
  const finalHeaders = { ...headers }
  if (withAuth && username && password) {
    finalHeaders.Authorization = authHeader(username, password)
  }

  let response
  try {
    response = await fetchOnce(url, {
      method,
      headers: finalHeaders,
      body,
    })
    if (
      withAuth &&
      response.status === 401 &&
      username &&
      password
    ) {
      const challenge = parseDigestChallenge(
        response.headers.get('www-authenticate'),
      )
      if (challenge) {
        finalHeaders.Authorization = buildDigestAuthorization(
          method,
          url,
          username,
          password,
          challenge,
        )
        response = await fetchOnce(url, {
          method,
          headers: finalHeaders,
          body,
        })
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ok: false,
      networkError: true,
      message,
      elapsedMs: Date.now() - started,
    }
  }

  const text = await response.text().catch(() => '')
  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    bodyPreview: text.slice(0, 400),
    elapsedMs: Date.now() - started,
  }
}

function corsHeaders(result) {
  return Object.entries(result.headers).filter(([key]) =>
    key.toLowerCase().startsWith('access-control-'),
  )
}

function printResult(label, result, url, { corsPreflight = false } = {}) {
  console.log(`\n=== ${label} ===`)
  console.log(`URL: ${url}`)
  if (result.networkError) {
    console.log(`FAIL (network): ${result.message}`)
    return false
  }
  console.log(`HTTP ${result.status} ${result.statusText} (${result.elapsedMs}ms)`)
  for (const [key, value] of corsHeaders(result)) {
    console.log(`${key}: ${value}`)
  }

  if (corsPreflight) {
    const allowOrigin = result.headers['access-control-allow-origin']
    const allowMethods = result.headers['access-control-allow-methods']
    if (result.status === 401 || result.status === 403) {
      console.log(
        'FAIL: 预检 OPTIONS 被要求登录。浏览器预检不会带 Authorization，Apache 需对 OPTIONS 放行并返回 CORS 头。',
      )
      return false
    }
    if (!allowOrigin || !allowMethods) {
      console.log('FAIL: 响应缺少 Access-Control-Allow-Origin / Allow-Methods')
      return false
    }
    if (result.status >= 200 && result.status < 300) {
      console.log('OK: 浏览器 CORS 预检可通过')
      return true
    }
    if (result.status === 204 || result.status === 405) {
      console.log('OK: 预检状态可接受')
      return Boolean(allowOrigin)
    }
    if (result.bodyPreview) console.log(`Body: ${result.bodyPreview}`)
    return false
  }

  if (!result.ok && result.status !== 404 && result.status !== 405) {
    if (result.bodyPreview) console.log(`Body: ${result.bodyPreview}`)
    return false
  }
  return true
}

async function main() {
  const config = loadConfig()
  if (!config.url || !config.username || !config.password) {
    console.error(`
缺少 WebDAV 配置。请任选一种方式：

1) 在项目根目录创建 webdav.local.json（已加入 .gitignore）：
{
  "url": "https://dav.jianguoyun.com/dav/",
  "username": "你的邮箱",
  "password": "应用密码",
  "remotePath": "branch"
}

2) 或设置环境变量后运行：
  $env:WEBDAV_URL="https://..."
  $env:WEBDAV_USER="..."
  $env:WEBDAV_PASS="..."
  node scripts/test-webdav.mjs
`)
    process.exit(1)
  }

  const base = config.url.trim().replace(/\/+$/, '')
  const remotePath = trimSlashes(config.remotePath || 'branch')
  const dirUrl = remotePath ? `${base}/${remotePath}` : base
  const fileUrl = `${dirUrl}/workspace.json`
  const origins = [
    'https://branch.sugarfun.xyz',
    'http://localhost:5173',
    'https://jing-gou.github.io',
  ]

  const serverProtocol = (() => {
    try {
      return new URL(`${base}/`).protocol
    } catch {
      return ''
    }
  })()

  console.log('Branch WebDAV connectivity test (Node, no CORS)')
  console.log(`Server: ${base}`)
  console.log(`Remote dir: ${remotePath || '(root)'}`)
  console.log(`Workspace file: ${fileUrl}`)

  if (serverProtocol === 'http:') {
    console.log('\n=== 混合内容警告 ===')
    console.log(
      'WebDAV 使用 http://，而 Branch 线上为 https://branch.sugarfun.xyz。',
    )
    console.log(
      '浏览器会拒绝 HTTPS 页面请求 HTTP 资源（与账密、CORS 无关也会 Failed to fetch）。',
    )
    console.log('请为 webdav.sugarfun.xyz 配置 HTTPS 证书，地址改为 https://…')
    try {
      const httpsBase = base.replace(/^http:/, 'https:')
      const probe = await fetch(`${httpsBase}/`, { method: 'HEAD' }).catch(
        (error) => ({ error }),
      )
      if (probe && 'error' in probe) {
        console.log(`HTTPS 探测失败: ${probe.error.message}`)
      } else if (probe && 'status' in probe) {
        console.log(`HTTPS 探测: HTTP ${probe.status}`)
      }
    } catch {
      /* ignore */
    }
  }

  let passed = 0
  let total = 0

  const steps = [
    ['1. PROPFIND server root', base, 'PROPFIND', { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' }, PROPFIND_BODY, true],
    ['2. PROPFIND remote directory', dirUrl, 'PROPFIND', { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' }, PROPFIND_BODY, true],
    ['3. GET workspace.json', fileUrl, 'GET', {}, undefined, true],
    ['4. OPTIONS (CORS preflight, no Authorization)', base, 'OPTIONS', {
      Origin: origins[0],
      'Access-Control-Request-Method': 'PROPFIND',
      'Access-Control-Request-Headers': 'authorization,content-type,depth',
    }, undefined, false],
  ]

  for (const [label, url, method, extraHeaders, body, withAuth] of steps) {
    total += 1
    const result = await request(url, {
      method,
      headers: extraHeaders,
      body,
      username: config.username,
      password: config.password,
      withAuth,
    })
    if (printResult(label, result, url, { corsPreflight: !withAuth })) passed += 1
  }

  total += 1
  console.log('\n=== 5. Digest in browser (Expose-Headers) ===')
  console.log(`URL: ${base}`)
  try {
    const exposeProbe = await fetch(base, {
      method: 'PROPFIND',
      headers: { Origin: origins[0] },
    })
    const expose =
      exposeProbe.headers.get('access-control-expose-headers') ?? ''
    const wwwAuth = exposeProbe.headers.get('www-authenticate')
    console.log(`HTTP ${exposeProbe.status} (unauthenticated probe)`)
    console.log(`Access-Control-Expose-Headers: ${expose || '(missing)'}`)
    if (wwwAuth?.toLowerCase().startsWith('digest')) {
      if (expose.toLowerCase().includes('www-authenticate')) {
        console.log('OK: 浏览器可读 WWW-Authenticate，Digest 认证可用')
        passed += 1
      } else {
        console.log(
          'FAIL: 服务器用 Digest，但未暴露 WWW-Authenticate。Branch 在浏览器里会报「认证失败」。',
        )
        console.log(
          '  Nginx 增加: add_header Access-Control-Expose-Headers "WWW-Authenticate" always;',
        )
      }
    } else {
      console.log('OK: 非 Digest 或无需 Expose-Headers')
      passed += 1
    }
  } catch (error) {
    console.log(
      `FAIL (network): ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  console.log('\n=== CORS / 服务器配置提示 ===')
  console.log(
    '步骤 4 的 401 不代表账密错误：浏览器预检 OPTIONS 不带账号密码。',
  )
  console.log(
    'Digest 认证还需 Expose-Headers，否则浏览器读不到 WWW-Authenticate。',
  )
  console.log(
    '需在 Apache/Nginx 上对 OPTIONS 返回 204/200，并带上 CORS 头，例如 Origin:',
  )
  console.log('  https://branch.sugarfun.xyz')
  console.log(
    '  Allow-Methods: GET, PUT, PROPFIND, OPTIONS, MKCOL',
  )
  console.log(
    '  Allow-Headers: Authorization, Content-Type, Depth',
  )
  for (const origin of origins) {
    console.log(`  允许的 Origin: ${origin}`)
  }

  console.log(`\nResult: ${passed}/${total} checks passed`)
  process.exit(passed === total ? 0 : 1)
}

main()
