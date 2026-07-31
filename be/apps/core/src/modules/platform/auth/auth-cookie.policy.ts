export type AuthCookieScope = { kind: 'managed-domain'; domain: string } | { kind: 'host-only' }

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/

function normalizeHostname(value: string | null | undefined): string | null {
  const candidate = value?.split(',', 1)[0]?.trim()
  if (!candidate) {
    return null
  }

  try {
    return new URL(candidate.includes('://') ? candidate : `http://${candidate}`).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function resolveAuthCookieScope(input: {
  requestHost: string | null | undefined
  baseDomain: string
}): AuthCookieScope {
  const requestHostname = normalizeHostname(input.requestHost)
  const baseDomain = normalizeHostname(input.baseDomain)
  if (!requestHostname || !baseDomain || IPV4_PATTERN.test(baseDomain) || baseDomain.includes(':')) {
    return { kind: 'host-only' }
  }

  if (requestHostname !== baseDomain && !requestHostname.endsWith(`.${baseDomain}`)) {
    return { kind: 'host-only' }
  }

  return { kind: 'managed-domain', domain: baseDomain }
}
