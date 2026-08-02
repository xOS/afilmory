import { galleryApiClient, getGalleryApiBaseUrl } from '@/api/client'
import { camelCaseKeys } from '@/modules/auth/case'

export const commentsApi = {
  async count(gallerySlug: string, photoId: string, signal?: AbortSignal): Promise<number> {
    const response = await galleryApiClient<unknown>('/comments/count', {
      baseURL: getGalleryApiBaseUrl(gallerySlug),
      query: { photoId },
      signal,
    })
    return camelCaseKeys<{ count: number }>(response).count
  },
}
