import type { GalleryPhoto } from '@/modules/galleries/types'

export interface PhotoMapLocation {
  latitude: number
  longitude: number
}

export interface PhotoMapItemModel extends PhotoMapLocation {
  accessibilityLabel: string
  id: string
  index: number
  thumbnailUrl: string
  title: string
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function decimalCoordinate(value: unknown, reference: unknown, limit: number): number | null {
  const coordinate = finiteNumber(value)
  if (coordinate === null || Math.abs(coordinate) > limit) {
    return null
  }

  const direction = typeof reference === 'string' ? reference.trim().toUpperCase() : ''
  if ((direction === 'S' || direction === 'SOUTH' || direction === 'W' || direction === 'WEST') && coordinate > 0) {
    return -coordinate
  }
  return coordinate
}

export function resolvePhotoMapLocation(photo: GalleryPhoto): PhotoMapLocation | null {
  const exif = photo.exif
  const latitude = decimalCoordinate(exif?.GPSLatitude ?? photo.location?.latitude, exif?.GPSLatitudeRef, 90)
  const longitude = decimalCoordinate(exif?.GPSLongitude ?? photo.location?.longitude, exif?.GPSLongitudeRef, 180)

  return latitude === null || longitude === null ? null : { latitude, longitude }
}

export function buildPhotoMapItems(
  photos: GalleryPhoto[],
  accessibilityLabel: (photo: GalleryPhoto) => string,
): PhotoMapItemModel[] {
  return photos.flatMap((photo, index) => {
    const location = resolvePhotoMapLocation(photo)
    if (!location) {
      return []
    }

    return [
      {
        ...location,
        accessibilityLabel: accessibilityLabel(photo),
        id: photo.id,
        index,
        thumbnailUrl: photo.thumbnailUrl,
        title: photo.title || photo.id,
      },
    ]
  })
}
