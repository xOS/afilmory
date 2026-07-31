import { translate } from '@/i18n'
import { definePage } from '@/presentation'

import { PhotoCommentsScreen } from './PhotoCommentsScreen'

export interface PhotoCommentsPageParams {
  gallerySlug: string
  photoId: string
  photoTitle: string
}

export const photoCommentsPage = definePage<PhotoCommentsPageParams>({
  Component: PhotoCommentsScreen,
  id: 'photo-comments',
  parseRouteParams: (params) => {
    const gallerySlug = Array.isArray(params.gallerySlug) ? params.gallerySlug[0] : params.gallerySlug
    const photoId = Array.isArray(params.photoId) ? params.photoId[0] : params.photoId
    const photoTitle = Array.isArray(params.photoTitle) ? params.photoTitle[0] : params.photoTitle
    if (!gallerySlug || !photoId) {
      throw new Error('Photo comments require a gallery and photo.')
    }
    return { gallerySlug, photoId, photoTitle: photoTitle ?? '' }
  },
  presentation: {
    detents: [0.62, 0.92],
    headerShown: false,
    style: 'formSheet',
  },
  title: translate('inspector.tab.comments'),
})
