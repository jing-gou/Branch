import { readFileSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'

const c = JSON.parse(readFileSync('webdav.local.json', 'utf8'))
const base = c.url.replace(/\/+$/, '')

function md5Hex(v) {
  return createHash('md5').update(v).digest('hex')
}

function parseDigest(h) {
  if (!h?.match(/^Digest/i)) return null
  const p = {}
  for (const part of h.replace(/^Digest\s+/i, '').split(',')) {
    const t = part.trim()
    const eq = t.indexOf('=')
    if (eq < 0) continue
    let v = t.slice(eq + 1).trim()
    if (v.startsWith('"')) v = v.slice(1, -1)
    p[t.slice(0, eq).trim().toLowerCase()] = v
  }
  return p.realm ? p : null
}

function digestAuth(method, url, ch) {
  const uri = new URL(url).pathname
  const ha1 = md5Hex(`${c.username}:${ch.realm}:${c.password}`)
  const ha2 = md5Hex(`${method.toUpperCase()}:${uri}`)
  const nc = '00000001'
  const cn = randomBytes(8).toString('hex')
  const resp = md5Hex(`${ha1}:${ch.nonce}:${nc}:${cn}:${ch.qop}:${ha2}`)
  return `Digest username="${c.username}", realm="${ch.realm}", nonce="${ch.nonce}", uri="${uri}", response="${resp}", algorithm=${ch.algorithm}, qop=${ch.qop}, nc=${nc}, cnonce="${cn}"`
}

async function getText(url) {
  let r = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.username}:${c.password}`).toString('base64')}`,
    },
  })
  if (r.status === 401) {
    const ch = parseDigest(r.headers.get('www-authenticate'))
    if (!ch) return null
    r = await fetch(url, { headers: { Authorization: digestAuth('GET', url, ch) } })
  }
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return r.text()
}

for (const path of ['branch/workspace.json', 'workspace.json']) {
  const raw = await getText(`${base}/${path}`)
  console.log(`\n=== ${path} ===`)
  if (!raw) {
    console.log('(not found)')
    continue
  }
  const data = JSON.parse(raw)
  const ws = data.workspace ?? data
  console.log('envelope version:', data.version ?? '(raw workspace)')
  console.log(
    'projects:',
    ws.projects?.length,
    ws.projects?.map((p) => p.name),
  )
}
