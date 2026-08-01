import * as SecureStore from 'expo-secure-store'

import { mergeRecentTags } from './uploadTags'

const STORAGE_KEY = 'studio.recentTags'

let cache: string[] = []

// SecureStore is the only persistence this app ships, and its synchronous API
// throws on simulator builds, so the list is hydrated once and served from
// memory — the review sheet renders before an await could resolve.
const hydration: Promise<void> = SecureStore.getItemAsync(STORAGE_KEY)
  .then((raw) => {
    if (!raw) {
      return
    }
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      cache = parsed.filter((tag): tag is string => typeof tag === 'string')
    }
  })
  .catch(() => {})

export function waitForRecentTags(): Promise<void> {
  return hydration
}

export function getRecentTags(): readonly string[] {
  return cache
}

export function rememberRecentTags(tags: readonly string[]): void {
  if (tags.length === 0) {
    return
  }
  cache = mergeRecentTags(tags, cache)
  void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(cache)).catch(() => {})
}
