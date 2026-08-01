import type { GalleryPhoto } from '@/modules/galleries/types'

export interface PhotoHeaderModel {
  subtitle: string
  title: string
}

interface FormattedCaptureDate {
  day: string
  time: string
}

type HeaderPhoto = Pick<GalleryPhoto, 'city' | 'dateTaken' | 'location' | 'title'>

const DAY_IN_MILLISECONDS = 86_400_000
const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const relativeDayFormatters = new Map<string, Intl.RelativeTimeFormat>()
const timeFormatters = new Map<string, Intl.DateTimeFormat>()

function formatterForDate(locale: string): Intl.DateTimeFormat {
  let formatter = dateFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    dateFormatters.set(locale, formatter)
  }
  return formatter
}

function formatterForRelativeDay(locale: string): Intl.RelativeTimeFormat {
  let formatter = relativeDayFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    relativeDayFormatters.set(locale, formatter)
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

function sentenceCase(value: string, locale: string): string {
  const [first = '', ...rest] = [...value]
  return first.toLocaleUpperCase(locale) + rest.join('')
}

function formatCaptureDate(value: string | null, locale: string, now: Date): FormattedCaptureDate | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const dayDifference = Math.round((localCalendarDay(date) - localCalendarDay(now)) / DAY_IN_MILLISECONDS)
  let day = formatterForDate(locale).format(date)
  if (Math.abs(dayDifference) <= 1) {
    day = sentenceCase(formatterForRelativeDay(locale).format(dayDifference, 'day'), locale)
  }

  return { day, time: formatterForTime(locale).format(date) }
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
  fallbackTitle: string,
  now = new Date(),
): PhotoHeaderModel {
  const captureDate = formatCaptureDate(photo.dateTaken, locale, now)
  const place = resolvePlace(photo)

  return {
    title: captureDate?.day || photo.title.trim() || fallbackTitle,
    subtitle: [captureDate?.time || '', place].filter(Boolean).join(' · '),
  }
}
