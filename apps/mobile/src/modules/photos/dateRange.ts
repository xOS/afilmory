import type { GalleryPhoto } from '@/modules/galleries/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatVisibleDateRange(photos: GalleryPhoto[], startIndex: number, endIndex: number): string | null {
  if (photos.length === 0) {
    return null
  }
  const start = Math.max(0, Math.min(startIndex, photos.length - 1))
  const end = Math.max(start, Math.min(endIndex, photos.length - 1))

  let newest: Date | null = null
  for (let i = start; i <= end && !newest; i++) {
    newest = parseDate(photos[i].dateTaken)
  }
  let oldest: Date | null = null
  for (let i = end; i >= start && !oldest; i--) {
    oldest = parseDate(photos[i].dateTaken)
  }
  if (!newest || !oldest) {
    return null
  }

  const currentYear = new Date().getFullYear()
  const from = oldest
  const to = newest
  const fromLabel = `${MONTHS[from.getMonth()]} ${from.getDate()}`
  const toLabel = `${MONTHS[to.getMonth()]} ${to.getDate()}`
  const yearSuffix = to.getFullYear() === currentYear ? '' : `, ${to.getFullYear()}`

  if (from.getFullYear() !== to.getFullYear()) {
    return `${MONTHS[from.getMonth()]} ${from.getFullYear()} – ${MONTHS[to.getMonth()]} ${to.getFullYear()}`
  }
  if (from.getMonth() === to.getMonth() && from.getDate() === to.getDate()) {
    return `${toLabel}${yearSuffix}`
  }
  if (from.getMonth() === to.getMonth()) {
    return `${MONTHS[from.getMonth()]} ${from.getDate()}–${to.getDate()}${yearSuffix}`
  }
  return `${fromLabel} – ${toLabel}${yearSuffix}`
}
