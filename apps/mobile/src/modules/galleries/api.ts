import { ofetch } from 'ofetch'

import { apiClient, SAAS_BASE_DOMAIN } from '@/api/client'

import type { FeaturedGallery, GalleryCoverPhoto, GalleryPhoto } from './types'

export async function fetchFeaturedGalleries(signal?: AbortSignal): Promise<FeaturedGallery[]> {
  const res = await apiClient<{ galleries: FeaturedGallery[] }>('/featured-galleries', { signal })
  return res.galleries
}

interface ManifestPhoto {
  id: string
  title?: string
  description?: string
  originalUrl?: string
  thumbnailUrl: string
  thumbHash?: string | null
  width?: number
  height?: number
  aspectRatio?: number
  dateTaken?: string | null
  video?: { type?: string } | null
  tags?: string[]
  exif?: { Make?: string, Model?: string, LensModel?: string, Rating?: number } | null
  location?: { city?: string | null, locationName?: string | null } | null
}

function photoAspectRatio(photo: ManifestPhoto): number {
  return photo.aspectRatio ?? (photo.width && photo.height ? photo.width / photo.height : 1)
}

function photoCamera(exif: ManifestPhoto['exif']): string | null {
  const make = exif?.Make?.trim()
  const model = exif?.Model?.trim()
  if (make && model) {
    return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`
  }
  return make || model || null
}

function photoLens(exif: ManifestPhoto['exif']): string | null {
  const lens = exif?.LensModel?.trim()
  return lens || null
}

function photoRating(exif: ManifestPhoto['exif']): number | null {
  if (exif?.Rating == null || !Number.isFinite(exif.Rating)) {
    return null
  }
  return Math.min(5, Math.max(0, Math.round(exif.Rating)))
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
      title: photo.title ?? '',
      description: photo.description ?? '',
      originalUrl: photo.originalUrl || photo.thumbnailUrl,
      thumbnailUrl: photo.thumbnailUrl,
      thumbHash: photo.thumbHash ?? null,
      aspectRatio: photoAspectRatio(photo),
      width: photo.width ?? 0,
      height: photo.height ?? 0,
      dateTaken: photo.dateTaken ?? null,
      isLive: Boolean(photo.video),
      tags: photo.tags ?? [],
      camera: photoCamera(photo.exif),
      lens: photoLens(photo.exif),
      rating: photoRating(photo.exif),
      city: photo.location?.city ?? photo.location?.locationName ?? null,
    }))
}

const COVER_COUNT = 3

const coverCache = new Map<string, GalleryCoverPhoto[]>()
const coverRequests = new Map<string, Promise<GalleryCoverPhoto[]>>()

export function getCachedGalleryCovers(slug: string): GalleryCoverPhoto[] | undefined {
  return coverCache.get(slug)
}

export async function fetchGalleryPreviewPhotos(slug: string, limit: number): Promise<GalleryCoverPhoto[]> {
  const res = await ofetch<{ data: ManifestPhoto[] }>(
    `https://${slug}.${SAAS_BASE_DOMAIN}/api/manifest/photos/search`,
    {
      method: 'POST',
      body: { limit, sort: 'desc' },
    },
  )
  return res.data.map(photo => ({
    id: photo.id,
    thumbnailUrl: photo.thumbnailUrl,
    thumbHash: photo.thumbHash ?? null,
    aspectRatio: photoAspectRatio(photo),
  }))
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

  const request = fetchGalleryPreviewPhotos(gallery.slug, COVER_COUNT)
    .then((covers) => {
      coverCache.set(gallery.slug, covers)
      return covers
    })
    .finally(() => {
      coverRequests.delete(gallery.slug)
    })

  coverRequests.set(gallery.slug, request)
  return request
}
