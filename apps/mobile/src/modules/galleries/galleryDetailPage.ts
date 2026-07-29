import { definePage } from '@/presentation'

import { GalleryDetailScreen } from './GalleryDetailScreen'
import type { FeaturedGallery } from './types'

export const galleryDetailPage = definePage<FeaturedGallery>({
  Component: GalleryDetailScreen,
  id: 'gallery-detail',
  parseRouteParams: (params) => {
    const serialized = Array.isArray(params.gallery) ? params.gallery[0] : params.gallery
    if (!serialized) {
      throw new Error('Gallery detail route requires a gallery.')
    }
    const gallery = JSON.parse(serialized) as FeaturedGallery
    if (typeof gallery?.slug !== 'string' || typeof gallery?.name !== 'string') {
      throw new TypeError('Gallery detail route received an invalid gallery.')
    }
    return gallery
  },
  presentation: { style: 'fullScreen' },
  title: 'Gallery',
})
