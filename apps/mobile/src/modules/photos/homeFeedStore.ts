import { useSyncExternalStore } from 'react'

import type { GalleryPhoto } from '@/modules/galleries/types'

import { clearFilters } from './filters/filterStore'

export interface HomeFeed {
  slug: string | null
  photos: GalleryPhoto[]
}

let state: HomeFeed = { slug: null, photos: [] }
const listeners = new Set<() => void>()

function getSnapshot(): HomeFeed {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useHomeFeed(): HomeFeed {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function setHomeFeed(slug: string, photos: GalleryPhoto[]): void {
  const slugChanged = state.slug !== slug
  state = { slug, photos }
  if (slugChanged) {
    clearFilters()
  }
  emit()
}

export function clearHomeFeed(): void {
  if (state.slug === null && state.photos.length === 0) {
    return
  }
  state = { slug: null, photos: [] }
  emit()
}
