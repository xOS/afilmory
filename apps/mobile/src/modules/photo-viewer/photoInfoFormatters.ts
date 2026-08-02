import type { GalleryExif, GalleryFujiRecipe, GalleryToneAnalysis, GalleryToneType } from '@/modules/galleries/types'

export type Translator = (key: string, options?: Record<string, unknown>) => string

const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const numberFormatters = new Map<string, Intl.NumberFormat>()
const signedFormatters = new Map<string, Intl.NumberFormat>()

export function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

export function translateExifValue(t: Translator, prefix: string, value: unknown): string | null {
  const text = textValue(value)
  if (!text) {
    return null
  }
  const suffix = text
    .toLowerCase()
    .replaceAll('&', 'and')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
  return t(`${prefix}.${suffix}`, { defaultValue: text })
}

export function numberValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  const key = `${locale}:${maximumFractionDigits}`
  let formatter = numberFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits })
    numberFormatters.set(key, formatter)
  }
  return formatter.format(value)
}

export function formatDate(value: string | null | undefined, locale: string): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  let formatter = dateFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'medium' })
    dateFormatters.set(locale, formatter)
  }
  return formatter.format(date)
}

export function formatFileSize(value: number | null, locale: string): string | null {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    return null
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${formatNumber(size, locale)} ${units[unitIndex]}`
}

export function formatMegapixels(width: number, height: number, locale: string): string | null {
  if (width <= 0 || height <= 0) {
    return null
  }
  return `${formatNumber((width * height) / 1_000_000, locale)} MP`
}

export function formatDimensions(width: number, height: number): string | null {
  return width > 0 && height > 0 ? `${width} × ${height}` : null
}

// exiftool hands back focal lengths and f-numbers as strings that may carry a
// trailing zero ("70.0"), which reads as noise next to Photos' own metrics.
function trimTrailingZero(value: number): string {
  return String(Number(value.toFixed(2)))
}

function focalLengthNumber(value: unknown): string | null {
  const numeric = numberValue(value)
  if (numeric !== null) {
    return trimTrailingZero(numeric)
  }
  const text = textValue(value)
  // exiftool already appends the unit ("70.0 mm"); re-parse so the trailing zero goes too.
  const withUnit = text?.match(/^(-?\d+(?:\.\d+)?)\s*mm$/i)
  return withUnit ? trimTrailingZero(Number(withUnit[1])) : null
}

export function formatFocalLength(value: unknown): string | null {
  const number = focalLengthNumber(value)
  if (number !== null) {
    return `${number} mm`
  }
  const text = textValue(value)
  if (!text) {
    return null
  }
  return /\bmm\b/i.test(text) ? text : `${text} mm`
}

/// Actual and 35mm-equivalent focal lengths are one fact in two unit systems, so
/// they share a cell — two bare `mm` values sitting apart read as two facts.
export function formatFocalPair(actual: unknown, equivalent: unknown): string | null {
  const actualNumber = focalLengthNumber(actual)
  const equivalentNumber = focalLengthNumber(equivalent)

  if (actualNumber !== null && equivalentNumber !== null && actualNumber !== equivalentNumber) {
    return `${actualNumber}→${equivalentNumber} mm`
  }
  return formatFocalLength(equivalent) ?? formatFocalLength(actual)
}

export function formatApertureGlyph(value: unknown): string | null {
  const numeric = numberValue(value)
  if (numeric !== null) {
    return `ƒ${trimTrailingZero(numeric)}`
  }
  const text = textValue(value)
  if (!text) {
    return null
  }
  return `ƒ${text.replace(/^f\//i, '')}`
}

export function formatExposureTime(value: unknown, locale: string): string | null {
  const numeric = numberValue(value)
  if (numeric !== null && numeric > 0) {
    if (numeric < 1) {
      return `1/${Math.round(1 / numeric)} s`
    }
    return `${formatNumber(numeric, locale, 2)} s`
  }

  const text = textValue(value)
  if (!text) {
    return null
  }
  return /\b(?:s|sec|seconds?)$/i.test(text) ? text : `${text} s`
}

export function formatEv(value: unknown): string | null {
  const text = textValue(value)
  if (!text) {
    return null
  }
  return /\bEV$/i.test(text) ? text : `${text} EV`
}

export function formatExposureBias(value: unknown, locale: string): string | null {
  const numeric = numberValue(value)
  if (numeric === null) {
    return null
  }
  let formatter = signedFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
    signedFormatters.set(locale, formatter)
  }
  return `${formatter.format(numeric)} ev`
}

export function formatIso(value: unknown): string | null {
  const text = textValue(value)
  return text ? `ISO ${text}` : null
}

export function formatMired(value: unknown): string | null {
  const text = textValue(value)
  if (!text) {
    return null
  }
  return /\bmired$/i.test(text) ? text : `${text} Mired`
}

export function joinMakeAndModel(makeValue: unknown, modelValue: unknown): string | null {
  const make = textValue(makeValue)
  const model = textValue(modelValue)
  if (make && model) {
    return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`
  }
  return make || model
}

export function formatCoordinate(value: unknown, reference: unknown): string | null {
  const coordinate = textValue(value)
  if (!coordinate) {
    return null
  }
  const suffix = textValue(reference)
  const formatted = coordinate.includes('°') ? coordinate : `${coordinate}°`
  return suffix ? `${formatted} ${suffix}` : formatted
}

export function decimalCoordinate(value: unknown, reference: unknown, limit: number): number | null {
  const coordinate = numberValue(value)
  if (coordinate === null) {
    return null
  }

  const direction = textValue(reference)?.toUpperCase()
  const signedCoordinate
    = direction === 'S' || direction === 'SOUTH' || direction === 'W' || direction === 'WEST'
      ? -Math.abs(coordinate)
      : coordinate

  return Math.abs(signedCoordinate) <= limit ? signedCoordinate : null
}

export function formatAltitude(exif: GalleryExif | null): string | null {
  if (!exif) {
    return null
  }
  const altitude = textValue(exif.GPSAltitude)
  if (!altitude) {
    return null
  }
  const reference = textValue(exif.GPSAltitudeRef)
  const isBelowSeaLevel = exif.GPSAltitudeRef === 1 || reference?.toLowerCase().includes('below')
  const signedAltitude = isBelowSeaLevel && !altitude.startsWith('-') ? `-${altitude}` : altitude
  return /\bm$/i.test(signedAltitude) ? signedAltitude : `${signedAltitude} m`
}

export function cleanRecipeValue(value: unknown): string | null {
  const text = textValue(value)
  return text?.replace(/\s*\([^)]*\)$/, '').trim() || null
}

export function formatFilmMode(value: unknown): string | null {
  const filmMode = textValue(value)
  switch (filmMode) {
    case 'F0/Standard (Provia)': {
      return 'Provia'
    }
    case 'F1b/Studio Portrait Smooth Skin Tone (Astia)': {
      return 'Astia'
    }
    case 'F2/Fujichrome (Velvia)':
    case 'F4/Velvia': {
      return 'Velvia'
    }
    default: {
      return filmMode
    }
  }
}

export function formatFujiDynamicRange(recipe: GalleryFujiRecipe, t: Translator): string | null {
  if (recipe.DynamicRangeSetting === 'Manual' && recipe.DevelopmentDynamicRange) {
    return `DR${recipe.DevelopmentDynamicRange}`
  }
  if (recipe.DynamicRangeSetting === 'Auto') {
    return t('action.auto')
  }
  return textValue(recipe.DynamicRange)
}

export function formatFujiWhiteBalance(recipe: GalleryFujiRecipe, t: Translator): string | null {
  if (recipe.WhiteBalance === 'Kelvin' && recipe.ColorTemperature) {
    return `${recipe.ColorTemperature} K`
  }
  return translateExifValue(t, 'exif.fujirecipe-whitebalance', recipe.WhiteBalance)
}

export function formatPercentage(value: number, scale: number): string | null {
  return Number.isFinite(value) ? `${Math.round(value * scale)}%` : null
}

const toneTypeKeys: Record<GalleryToneType, string> = {
  'low-key': 'exif.tone.low-key',
  'high-key': 'exif.tone.high-key',
  'normal': 'exif.tone.normal',
  'high-contrast': 'exif.tone.high-contrast',
}

export function formatToneType(toneAnalysis: GalleryToneAnalysis | null, t: Translator): string | null {
  if (!toneAnalysis) {
    return null
  }
  return t(toneTypeKeys[toneAnalysis.toneType] ?? toneAnalysis.toneType)
}
