import type { GalleryPhoto } from '@/modules/galleries/types'

const LOCATION_MARKERS = [
  '省',
  '市',
  '区',
  '县',
  '镇',
  '村',
  '街道',
  '路',
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '南京',
  '成都',
]

function looksLikeLocation(tag: string): boolean {
  return LOCATION_MARKERS.some(marker => tag.includes(marker))
}

export function cityForRange(photos: GalleryPhoto[], startIndex: number, endIndex: number): string | null {
  if (photos.length === 0) {
    return null
  }
  const start = Math.max(0, Math.min(startIndex, photos.length - 1))
  const end = Math.max(start, Math.min(endIndex, photos.length - 1))

  for (let i = start; i <= end; i++) {
    if (photos[i].city) {
      return photos[i].city
    }
  }

  for (let i = start; i <= end; i++) {
    const tag = photos[i].tags.find(looksLikeLocation)
    if (tag) {
      return tag
    }
  }

  return null
}
