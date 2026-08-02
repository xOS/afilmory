import { galleryApiClient, getGalleryApiBaseUrl } from '@/api/client'

import type { PhotoReaction } from './photoReactionState'
import { normalizePhotoReactionCounts } from './photoReactionState'

interface ReactionAnalysisResponse {
  data?: {
    reactions?: unknown
  }
}

export async function fetchPhotoReactionCounts(
  gallerySlug: string,
  photoId: string,
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const response = await galleryApiClient<ReactionAnalysisResponse>('/reactions', {
    baseURL: getGalleryApiBaseUrl(gallerySlug),
    query: { refKey: photoId },
    signal,
  })
  return normalizePhotoReactionCounts(response.data?.reactions)
}

export async function addPhotoReaction(
  gallerySlug: string,
  photoId: string,
  reaction: PhotoReaction,
  count: number,
): Promise<void> {
  await galleryApiClient('/reactions/add', {
    baseURL: getGalleryApiBaseUrl(gallerySlug),
    body: { count, reaction, refKey: photoId },
    method: 'POST',
  })
}
