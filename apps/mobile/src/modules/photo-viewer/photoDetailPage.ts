import { translate } from '@/i18n'
import { definePage } from '@/presentation'

import { PhotoDetailScreen } from './PhotoDetailScreen'

export interface PhotoDetailRouteParams {
  photoId: string
  sessionId: string
}

export const photoDetailPage = definePage<PhotoDetailRouteParams>({
  Component: PhotoDetailScreen,
  id: 'photo-detail',
  parseRouteParams: (params) => {
    const photoId = Array.isArray(params.photoId) ? params.photoId[0] : params.photoId
    const sessionId = Array.isArray(params.session) ? params.session[0] : params.session
    if (!photoId || !sessionId) {
      throw new Error('Photo detail route requires a photo and viewer session.')
    }
    return { photoId, sessionId }
  },
  presentation: { animationType: 'none', headerShown: false, style: 'fullScreen' },
  title: translate('page.photo'),
})
