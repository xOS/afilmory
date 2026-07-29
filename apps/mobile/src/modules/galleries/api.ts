import { ofetch } from 'ofetch'

import { apiClient, SAAS_BASE_DOMAIN } from '@/api/client'

import type { FeaturedGallery, GalleryCoverPhoto, GalleryPhoto } from './types'

export async function fetchFeaturedGalleries(signal?: AbortSignal): Promise<FeaturedGallery[]> {
  const res = await apiClient<{ galleries: FeaturedGallery[] }>('/featured-galleries', { signal })
  return res.galleries
}

interface ManifestPhoto {
  id: string
  thumbnailUrl: string
  thumbHash?: string | null
  width?: number
  height?: number
  aspectRatio?: number
  dateTaken?: string | null
}

function photoAspectRatio(photo: ManifestPhoto): number {
  return photo.aspectRatio ?? (photo.width && photo.height ? photo.width / photo.height : 1)
}

export async function fetchGalleryManifest(slug: string, signal?: AbortSignal): Promise<GalleryPhoto[]> {
  const res = await ofetch<{ data: ManifestPhoto[] }>(`https://${slug}.${SAAS_BASE_DOMAIN}/api/manifest`, {
    signal,
  })
  return res.data
    .filter(photo => photo.thumbnailUrl)
    .sort((a, b) => (b.dateTaken ?? '').localeCompare(a.dateTaken ?? ''))
    .map(photo => ({
      id: photo.id,
      thumbnailUrl: photo.thumbnailUrl,
      thumbHash: photo.thumbHash ?? null,
      aspectRatio: photoAspectRatio(photo),
      width: photo.width ?? 0,
      height: photo.height ?? 0,
    }))
}

const COVER_COUNT = 3

const coverCache = new Map<string, GalleryCoverPhoto[]>()
const coverRequests = new Map<string, Promise<GalleryCoverPhoto[]>>()

export function getCachedGalleryCovers(slug: string): GalleryCoverPhoto[] | undefined {
  return coverCache.get(slug)
}

export function fetchGalleryCovers(gallery: FeaturedGallery): Promise<GalleryCoverPhoto[]> {
  const cached = coverCache.get(gallery.slug)
  if (cached) {
    return Promise.resolve(cached)
  }
  const pending = coverRequests.get(gallery.slug)
  if (pending) {
    return pending
  }

  const request = ofetch<{ data: ManifestPhoto[] }>(
    `https://${gallery.slug}.${SAAS_BASE_DOMAIN}/api/manifest/photos/search`,
    {
      method: 'POST',
      body: { limit: COVER_COUNT, sort: 'desc' },
    },
  )
    .then((res) => {
      const covers = res.data.map(photo => ({
        id: photo.id,
        thumbnailUrl: photo.thumbnailUrl,
        thumbHash: photo.thumbHash ?? null,
        aspectRatio: photoAspectRatio(photo),
      }))
      coverCache.set(gallery.slug, covers)
      return covers
    })
    .finally(() => {
      coverRequests.delete(gallery.slug)
    })

  coverRequests.set(gallery.slug, request)
  return request
}
