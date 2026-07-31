import type { GalleryPhoto } from '@/modules/galleries/types'

const monthFormatters = new Map<string, Intl.DateTimeFormat>()

function getMonthFormatter(locale: string, includeYear: boolean): Intl.DateTimeFormat {
  const key = `${locale}:${includeYear ? 'year' : 'current'}`
  const existing = monthFormatters.get(key)
  if (existing) {
    return existing
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    month: 'long',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
  monthFormatters.set(key, formatter)
  return formatter
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatVisibleMonthAnchor(
  photos: GalleryPhoto[],
  startIndex: number,
  endIndex: number,
  locale: string,
): string | null {
  if (photos.length === 0) {
    return null
  }
  const start = Math.max(0, Math.min(startIndex, photos.length - 1))
  const end = Math.max(start, Math.min(endIndex, photos.length - 1))

  const counts = new Map<number, number>()
  for (let i = start; i <= end; i++) {
    const date = parseDate(photos[i].dateTaken)
    if (!date) {
      continue
    }
    const bucket = date.getFullYear() * 12 + date.getMonth()
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1)
  }
  if (counts.size === 0) {
    return null
  }

  let anchor = -1
  let anchorCount = 0
  for (const [bucket, count] of counts) {
    if (count > anchorCount || (count === anchorCount && bucket > anchor)) {
      anchor = bucket
      anchorCount = count
    }
  }

  const year = Math.floor(anchor / 12)
  const month = anchor % 12
  const includeYear = year !== new Date().getFullYear()
  return getMonthFormatter(locale, includeYear).format(new Date(year, month, 1))
}
