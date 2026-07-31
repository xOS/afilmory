import type { PhotoMasonryItem } from 'photo-masonry'

import type { GalleryPhoto } from './types'
import { livePhotoVideoUrl } from './videoSource'

/**
 * Builds the object consumed by Expo's native Record converter.
 *
 * Optional Record fields must be omitted. Passing JavaScript `null` causes
 * Expo to reject the complete view prop update before it reaches Swift.
 */
export function buildPhotoMasonryItem(photo: GalleryPhoto, accessibilityLabel: string): PhotoMasonryItem {
  const videoUrl = livePhotoVideoUrl(photo.video)

  return {
    accessibilityLabel,
    aspectRatio: photo.aspectRatio,
    height: photo.height,
    id: photo.id,
    originalUrl: photo.originalUrl,
    url: photo.thumbnailUrl,
    width: photo.width,
    ...(photo.thumbHash === null ? {} : { thumbHash: photo.thumbHash }),
    ...(videoUrl === null ? {} : { livePhotoVideoUrl: videoUrl }),
  }
}
