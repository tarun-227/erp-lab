import type { ProcessParams } from './types'

// Parameters (never data) travel in the URL as base64url-encoded JSON: ?p=...

export function encodeParams(p: ProcessParams): string {
  const bytes = new TextEncoder().encode(JSON.stringify(p))
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeParams(s: string): ProcessParams | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))
    return isParams(p) ? p : null
  } catch {
    return null
  }
}

export function isParams(p: unknown): p is ProcessParams {
  const o = p as ProcessParams
  return Boolean(
    o &&
      Array.isArray(o.conditions) &&
      o.conditions.every((c) => typeof c.code === 'number' && typeof c.name === 'string') &&
      ['tmin', 'tmax', 'baseline_start', 'baseline_end', 'peak_start', 'peak_end'].every((k) => typeof o[k as keyof ProcessParams] === 'number') &&
      typeof o.reference === 'string' &&
      typeof o.channel === 'string',
  )
}

export function shareUrl(p: ProcessParams): string {
  const url = new URL(window.location.href)
  url.search = `?p=${encodeParams(p)}`
  url.hash = ''
  return url.toString()
}

export function downloadText(filename: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
