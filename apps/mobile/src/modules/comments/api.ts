import { galleryApiClient, getGalleryApiBaseUrl } from '@/api/client'
import { camelCaseKeys } from '@/modules/auth/case'

import type { CommentPage, PhotoComment } from './types'

interface CreateCommentInput {
  content: string
  gallerySlug: string
  parentId: string | null
  photoId: string
}

interface ListCommentsInput {
  cursor?: string | null
  gallerySlug: string
  limit?: number
  photoId: string
  signal?: AbortSignal
}

interface ToggleReactionInput {
  commentId: string
  gallerySlug: string
  reaction?: string
}

export const commentsApi = {
  async count(gallerySlug: string, photoId: string, signal?: AbortSignal): Promise<number> {
    const response = await galleryApiClient<unknown>('/comments/count', {
      baseURL: getGalleryApiBaseUrl(gallerySlug),
      query: { photoId },
      signal,
    })
    return camelCaseKeys<{ count: number }>(response).count
  },

  async create(input: CreateCommentInput): Promise<CommentPage> {
    const response = await galleryApiClient<unknown>('/comments', {
      baseURL: getGalleryApiBaseUrl(input.gallerySlug),
      body: {
        content: input.content,
        parentId: input.parentId ?? undefined,
        photoId: input.photoId,
      },
      method: 'POST',
    })
    return {
      ...camelCaseKeys<Omit<CommentPage, 'nextCursor'>>(response),
      nextCursor: null,
    }
  },

  async list({ cursor, gallerySlug, limit = 20, photoId, signal }: ListCommentsInput): Promise<CommentPage> {
    const response = await galleryApiClient<unknown>('/comments', {
      baseURL: getGalleryApiBaseUrl(gallerySlug),
      query: { cursor: cursor ?? undefined, limit, photoId },
      signal,
    })
    return camelCaseKeys<CommentPage>(response)
  },

  async toggleReaction({ commentId, gallerySlug, reaction = 'like' }: ToggleReactionInput): Promise<PhotoComment> {
    const response = await galleryApiClient<unknown>(`/comments/${commentId}/reactions`, {
      baseURL: getGalleryApiBaseUrl(gallerySlug),
      body: { reaction },
      method: 'POST',
    })
    return camelCaseKeys<{ item: PhotoComment }>(response).item
  },
}

export function httpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }
  if ('status' in error && typeof error.status === 'number') {
    return error.status
  }
  if (
    'response' in error
    && error.response
    && typeof error.response === 'object'
    && 'status' in error.response
    && typeof error.response.status === 'number'
  ) {
    return error.response.status
  }
  return null
}
