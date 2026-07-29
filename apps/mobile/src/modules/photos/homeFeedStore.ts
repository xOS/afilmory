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

export function setHomeFeed(slug: string, photos: GalleryPhoto[]): void {
  const slugChanged = state.slug !== slug
  state = { slug, photos }
  if (slugChanged) {
    clearFilters()
  }
  for (const listener of listeners) {
    listener()
  }
}
