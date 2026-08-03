import { ofetch } from 'ofetch'

import { apiClient, getGalleryOrigin } from '@/api/client'

import type { FeaturedGallery, GalleryCoverPhoto } from './types'

export async function fetchFeaturedGalleries(signal?: AbortSignal): Promise<FeaturedGallery[]> {
  const response = await apiClient<{ galleries: FeaturedGallery[] }>('/featured-galleries', { signal })
  return response.galleries
}

interface ManifestCoverPhoto {
  id: string
  thumbnailUrl: string
  thumbHash?: string | null
  width?: number
  height?: number
  aspectRatio?: number
  video?: unknown
}

function isLivePhoto(video: unknown): boolean {
  return typeof video === 'object' && video !== null && 'type' in video && video.type === 'live-photo'
}

export async function fetchGalleryPreviewPhotos(slug: string, limit: number): Promise<GalleryCoverPhoto[]> {
  const galleryOrigin = getGalleryOrigin(slug)
  const response = await ofetch<{ data: ManifestCoverPhoto[] }>(`${galleryOrigin}/api/manifest/photos/search`, {
    body: { limit, sort: 'desc' },
    method: 'POST',
  })
  return response.data.map(photo => ({
    aspectRatio: photo.aspectRatio ?? (photo.width && photo.height ? photo.width / photo.height : 1),
    id: photo.id,
    isLivePhoto: isLivePhoto(photo.video),
    thumbnailUrl: photo.thumbnailUrl,
    thumbHash: photo.thumbHash ?? null,
  }))
}
