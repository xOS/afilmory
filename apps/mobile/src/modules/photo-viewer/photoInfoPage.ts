import type { GalleryPhoto } from '@/modules/galleries/types'
import { definePage } from '@/presentation'

import { PhotoInfoSheet } from './PhotoInfoSheet'

export const photoInfoPage = definePage<GalleryPhoto>({
  Component: PhotoInfoSheet,
  id: 'photo-info',
  parseRouteParams: (params) => {
    const serialized = Array.isArray(params.photo) ? params.photo[0] : params.photo
    if (!serialized) {
      throw new Error('Photo info route requires a photo.')
    }
    return JSON.parse(serialized) as GalleryPhoto
  },
  presentation: {
    animationType: 'slide',
    detents: [0.48, 0.82],
    headerShown: false,
    style: 'formSheet',
  },
  title: 'Photo information',
})
