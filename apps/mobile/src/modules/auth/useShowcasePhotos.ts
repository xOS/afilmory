import { useEffect, useState } from 'react'

import { fetchFeaturedGalleries, fetchGalleryPreviewPhotos } from '@/modules/galleries/api'
import type { GalleryCoverPhoto } from '@/modules/galleries/types'

const GALLERY_COUNT = 4
const PHOTOS_PER_GALLERY = 8
const POOL_LIMIT = 24

let cachedPool: GalleryCoverPhoto[] | null = null
let pending: Promise<GalleryCoverPhoto[]> | null = null

async function loadPool(): Promise<GalleryCoverPhoto[]> {
  const galleries = (await fetchFeaturedGalleries()).slice(0, GALLERY_COUNT)
  const batches = await Promise.all(
    galleries.map(gallery => fetchGalleryPreviewPhotos(gallery.slug, PHOTOS_PER_GALLERY).catch(() => [])),
  )

  const pool: GalleryCoverPhoto[] = []
  for (let index = 0; pool.length < POOL_LIMIT; index++) {
    let drained = true
    for (const batch of batches) {
      const photo = batch[index]
      if (!photo) {
        continue
      }
      drained = false
      pool.push(photo)
      if (pool.length >= POOL_LIMIT) {
        break
      }
    }
    if (drained) {
      break
    }
  }
  return pool
}

export function useShowcasePhotos(): GalleryCoverPhoto[] {
  const [pool, setPool] = useState<GalleryCoverPhoto[]>(cachedPool ?? [])

  useEffect(() => {
    if (cachedPool) {
      return
    }
    let cancelled = false
    pending ??= loadPool()
    pending
      .then((result) => {
        if (result.length > 0) {
          cachedPool = result
        }
        if (!cancelled) {
          setPool(result)
        }
      })
      .catch(() => {})
      .finally(() => {
        pending = null
      })
    return () => {
      cancelled = true
    }
  }, [])

  return pool
}
