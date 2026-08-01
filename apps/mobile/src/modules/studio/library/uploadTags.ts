export const RECENT_TAGS_LIMIT = 8

// Mirrors sanitizeTagSegment/deriveDirectoryFromTags in the dashboard's
// photo-upload/utils.ts. The server only trims the directory field, so both
// clients must agree here or the same tags land under different storage keys.
export function sanitizeTagSegment(tag: string): string {
  if (typeof tag !== 'string') {
    return ''
  }
  return tag
    .normalize('NFKC')
    .trim()
    .replaceAll(/[\\/]+/g, '-')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^\w\u{A0}-\u{FFFF}.-]/gu, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
}

export function deriveDirectoryFromTags(tags: readonly string[]): string | null {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null
  }
  const segments = tags.map(tag => sanitizeTagSegment(tag)).filter(segment => segment.length > 0)
  return segments.length === 0 ? null : segments.join('/')
}

export function mergeRecentTags(incoming: readonly string[], existing: readonly string[]): string[] {
  const seen = new Set<string>()
  const head: string[] = []
  for (const tag of incoming) {
    const normalized = tag.trim().toLowerCase()
    if (normalized.length === 0 || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    head.push(normalized)
  }
  const tail = existing.map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0 && !seen.has(tag))
  return [...head, ...tail].slice(0, RECENT_TAGS_LIMIT)
}

// Recently used tags float to the front so the common case is one tap, while
// everything already in the workspace stays reachable behind them.
export function orderTagSuggestions(available: readonly string[], recent: readonly string[]): string[] {
  const priority = new Map(recent.map((tag, index) => [tag, index]))
  const seen = new Set<string>()
  const options: string[] = []
  for (const tag of available) {
    const normalized = tag.trim().toLowerCase()
    if (normalized.length === 0 || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    options.push(normalized)
  }
  // Not toSorted: Hermes ships no ES2023 array copy methods, and the dashboard
  // helper this mirrors runs on a browser engine that does.
  return options.sort(
    (a, b) => (priority.get(a) ?? Number.POSITIVE_INFINITY) - (priority.get(b) ?? Number.POSITIVE_INFINITY),
  )
}
