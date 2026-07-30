import type { GalleryPhoto } from '@/modules/galleries/types'

const dateFormatters = new Map<string, Intl.DateTimeFormat>()

function getDateFormatter(locale: string, includeYear: boolean): Intl.DateTimeFormat {
  const key = `${locale}:${includeYear ? 'year' : 'current'}`
  const existing = dateFormatters.get(key)
  if (existing) {
    return existing
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
  dateFormatters.set(key, formatter)
  return formatter
}

function parseDate(value: string | null): Date | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatVisibleDateRange(
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
  const includeYear = from.getFullYear() !== currentYear || to.getFullYear() !== currentYear
  const formatter = getDateFormatter(locale, includeYear)
  const fromLabel = formatter.format(from)
  const toLabel = formatter.format(to)
  return from.getTime() === to.getTime() ? toLabel : `${fromLabel} – ${toLabel}`
}
