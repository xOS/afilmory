import { ofetch } from 'ofetch'

import { apiClient, getGalleryOrigin } from '@/api/client'

import type {
  FeaturedGallery,
  GalleryCoverPhoto,
  GalleryExif,
  GalleryLocation,
  GalleryPhoto,
  GalleryToneAnalysis,
} from './types'
import { isLivePhoto, normalizeGalleryVideoSource } from './videoSource'

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
  format?: string
  size?: number
  dateTaken?: string | null
  video?: unknown
  tags?: string[]
  exif?: GalleryExif | null
  toneAnalysis?: GalleryToneAnalysis | null
  location?: {
    latitude?: number
    longitude?: number
    country?: string | null
    city?: string | null
    locationName?: string | null
  } | null
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

function photoLocation(location: ManifestPhoto['location']): GalleryLocation | null {
  if (!location) {
    return null
  }

  return {
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    country: location.country ?? null,
    city: location.city ?? null,
    locationName: location.locationName ?? null,
  }
}

export async function fetchGalleryManifest(slug: string, signal?: AbortSignal): Promise<GalleryPhoto[]> {
  const galleryOrigin = getGalleryOrigin(slug)
  const res = await ofetch<{ data: ManifestPhoto[] }>(`${galleryOrigin}/api/manifest`, {
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
      format: photo.format ?? null,
      size: photo.size ?? null,
      dateTaken: photo.dateTaken ?? null,
      video: normalizeGalleryVideoSource(photo.video, galleryOrigin),
      tags: photo.tags ?? [],
      exif: photo.exif ?? null,
      toneAnalysis: photo.toneAnalysis ?? null,
      location: photoLocation(photo.location),
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
  const galleryOrigin = getGalleryOrigin(slug)
  const res = await ofetch<{ data: ManifestPhoto[] }>(`${galleryOrigin}/api/manifest/photos/search`, {
    method: 'POST',
    body: { limit, sort: 'desc' },
  })
  return res.data.map((photo) => {
    const video = normalizeGalleryVideoSource(photo.video, galleryOrigin)
    return {
      id: photo.id,
      thumbnailUrl: photo.thumbnailUrl,
      thumbHash: photo.thumbHash ?? null,
      aspectRatio: photoAspectRatio(photo),
      isLivePhoto: isLivePhoto(video),
    }
  })
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
