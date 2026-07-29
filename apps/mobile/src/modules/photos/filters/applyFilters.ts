import type { GalleryPhoto } from '@/modules/galleries/types'

import type { PhotoFilters } from './filterTypes'

export function applyFilters(photos: GalleryPhoto[], filters: PhotoFilters): GalleryPhoto[] {
  const { tags, tagMode, dateFrom, dateTo, cameras, lenses, minRating } = filters
  const tagsActive = tags.length > 0
  const dateActive = dateFrom !== null || dateTo !== null
  const camerasActive = cameras.length > 0
  const lensesActive = lenses.length > 0
  const ratingActive = minRating !== null

  if (!tagsActive && !dateActive && !camerasActive && !lensesActive && !ratingActive) {
    return photos
  }

  const tagSet = new Set(tags)
  const cameraSet = new Set(cameras)
  const lensSet = new Set(lenses)

  return photos.filter((photo) => {
    if (tagsActive) {
      const matches
        = tagMode === 'all' ? tags.every(tag => photo.tags.includes(tag)) : photo.tags.some(tag => tagSet.has(tag))
      if (!matches) {
        return false
      }
    }

    if (dateActive) {
      if (!photo.dateTaken) {
        return false
      }
      const date = photo.dateTaken.slice(0, 10)
      if (dateFrom !== null && date < dateFrom) {
        return false
      }
      if (dateTo !== null && date > dateTo) {
        return false
      }
    }

    if (camerasActive && (!photo.camera || !cameraSet.has(photo.camera))) {
      return false
    }

    if (lensesActive && (!photo.lens || !lensSet.has(photo.lens))) {
      return false
    }

    if (minRating !== null && (photo.rating === null || photo.rating < minRating)) {
      return false
    }

    return true
  })
}
