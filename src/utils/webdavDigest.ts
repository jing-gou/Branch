import { md5 } from 'js-md5'

export interface DigestChallenge {
  realm: string
  nonce: string
  algorithm?: string
  qop?: string
  opaque?: string
}

export function parseDigestChallenge(
  wwwAuthenticate: string | null,
): DigestChallenge | null {
  if (!wwwAuthenticate) return null
  const match = wwwAuthenticate.match(/^Digest\s+/i)
  if (!match) return null

  const params: Record<string, string> = {}
  const body = wwwAuthenticate.slice(match[0].length)
  for (const part of body.split(',')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim().toLowerCase()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    params[key] = value
  }

  if (!params.realm || !params.nonce) return null

  return {
    realm: params.realm,
    nonce: params.nonce,
    algorithm: params.algorithm,
    qop: params.qop,
    opaque: params.opaque,
  }
}

function md5Hex(value: string): string {
  return md5.hex(value)
}

function randomCnonce(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function buildDigestAuthorization(
  method: string,
  requestUrl: string,
  username: string,
  password: string,
  challenge: DigestChallenge,
  nc = '00000001',
): string {
  const uri = new URL(requestUrl).pathname + new URL(requestUrl).search
  const ha1 = md5Hex(`${username}:${challenge.realm}:${password}`)
  const ha2 = md5Hex(`${method}:${uri}`)
  const cnonce = randomCnonce()

  let response: string
  if (challenge.qop === 'auth' || challenge.qop === 'auth-int') {
    response = md5Hex(
      `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`,
    )
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
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`)

  return `Digest ${parts.join(', ')}`
}
