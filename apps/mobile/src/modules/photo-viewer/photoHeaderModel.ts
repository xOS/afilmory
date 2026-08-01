import type { GalleryPhoto } from '@/modules/galleries/types'

export interface PhotoHeaderModel {
  subtitle: string
  title: string
}

export interface PhotoHeaderStrings {
  fallbackTitle: string
  today: string
  yesterday: string
}

interface FormattedCaptureDate {
  day: string
  time: string
}

type HeaderPhoto = Pick<GalleryPhoto, 'city' | 'dateTaken' | 'location' | 'title'>

const DAY_IN_MILLISECONDS = 86_400_000
const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const timeFormatters = new Map<string, Intl.DateTimeFormat>()

function formatterForDate(locale: string): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    dateFormatters.set(locale, formatter)
  }
  return formatter
}

function formatterForTime(locale: string): Intl.DateTimeFormat {
  let formatter = timeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })
    timeFormatters.set(locale, formatter)
  }
  return formatter
}

function localCalendarDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
}

// Hermes ships only Collator, DateTimeFormat and NumberFormat, so the relative
// day cannot come from Intl.RelativeTimeFormat — the caller supplies the labels.
function relativeDay(dayDifference: number, strings: PhotoHeaderStrings): string | null {
  if (dayDifference === 0) {
    return strings.today
  }
  if (dayDifference === -1) {
    return strings.yesterday
  }
  return null
}

function formatCaptureDate(
  value: string | null,
  locale: string,
  strings: PhotoHeaderStrings,
  now: Date,
): FormattedCaptureDate | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const dayDifference = Math.round((localCalendarDay(date) - localCalendarDay(now)) / DAY_IN_MILLISECONDS)

  return {
    day: relativeDay(dayDifference, strings) ?? formatterForDate(locale).format(date),
    time: formatterForTime(locale).format(date),
  }
}

function resolvePlace(photo: HeaderPhoto): string {
  const locationCity = photo.location?.city?.trim()
  if (locationCity) {
    return locationCity
  }
  const city = photo.city?.trim()
  if (city) {
    return city
  }
  return photo.location?.country?.trim() || ''
}

export function buildPhotoHeaderModel(
  photo: HeaderPhoto,
  locale: string,
  strings: PhotoHeaderStrings,
  now = new Date(),
): PhotoHeaderModel {
  const captureDate = formatCaptureDate(photo.dateTaken, locale, strings, now)
  const place = resolvePlace(photo)

  return {
    title: captureDate?.day || photo.title.trim() || strings.fallbackTitle,
    subtitle: [captureDate?.time || '', place].filter(Boolean).join(' · '),
  }
}
