import { getIntlLocale, translate } from '@/i18n'
import type {
  GalleryExif,
  GalleryFujiRecipe,
  GalleryPhoto,
  GalleryToneAnalysis,
  GalleryToneType,
} from '@/modules/galleries/types'

export interface PhotoInfoRow {
  id: string
  label: string
  value: string
}

export interface PhotoInfoSection {
  id: string
  title: string
  rows: PhotoInfoRow[]
}

export interface CaptureParameter {
  id: string
  label: string
  value: string
}

export interface PhotoInfoToneAnalysis {
  histogramUrl: string
  metrics: PhotoInfoRow[]
  tone: PhotoInfoRow
}

export interface PhotoInfoMapLocation {
  latitude: number
  longitude: number
}

export interface PhotoInfoModel {
  basic: PhotoInfoSection
  captureParameters: CaptureParameter[]
  hasExif: boolean
  mapLocation: PhotoInfoMapLocation | null
  sections: PhotoInfoSection[]
  toneAnalysis: PhotoInfoToneAnalysis | null
}

type NullablePhotoInfoRow = Omit<PhotoInfoRow, 'value'> & { value: string | null }
type NullableCaptureParameter = Omit<CaptureParameter, 'value'> & { value: string | null }
type Translator = (key: string, options?: Record<string, unknown>) => string

const dateFormatters = new Map<string, Intl.DateTimeFormat>()
const numberFormatters = new Map<string, Intl.NumberFormat>()

function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
}

function translateExifValue(t: Translator, prefix: string, value: unknown): string | null {
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

function numberValue(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumber(value: number, locale: string, maximumFractionDigits = 1): string {
  const key = `${locale}:${maximumFractionDigits}`
  let formatter = numberFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits })
    numberFormatters.set(key, formatter)
  }
  return formatter.format(value)
}

function formatDate(value: string | null | undefined, locale: string): string | null {
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

function formatFileSize(value: number | null, locale: string): string | null {
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

function formatMegapixels(width: number, height: number, locale: string): string | null {
  if (width <= 0 || height <= 0) {
    return null
  }
  return `${formatNumber((width * height) / 1_000_000, locale)} MP`
}

function formatFocalLength(value: unknown): string | null {
  const text = textValue(value)
  if (!text) {
    return null
  }
  return /\bmm\b/i.test(text) ? text : `${text} mm`
}

function formatAperture(value: unknown): string | null {
  const text = textValue(value)
  if (!text) {
    return null
  }
  return /^f\//i.test(text) ? text : `f/${text}`
}

function formatExposureTime(value: unknown, locale: string): string | null {
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

function formatEv(value: unknown): string | null {
  const text = textValue(value)
  if (!text) {
    return null
  }
  return /\bEV$/i.test(text) ? text : `${text} EV`
}

function formatMired(value: unknown): string | null {
  const text = textValue(value)
  if (!text) {
    return null
  }
  return /\bmired$/i.test(text) ? text : `${text} Mired`
}

function formatRating(value: number | null): string | null {
  if (value === null || value <= 0) {
    return null
  }
  return '★'.repeat(Math.min(5, Math.max(1, Math.round(value))))
}

function joinMakeAndModel(makeValue: unknown, modelValue: unknown): string | null {
  const make = textValue(makeValue)
  const model = textValue(modelValue)
  if (make && model) {
    return model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`
  }
  return make || model
}

function createRows(rows: NullablePhotoInfoRow[]): PhotoInfoRow[] {
  return rows.filter((row): row is PhotoInfoRow => row.value !== null)
}

function createSection(id: string, title: string, rows: PhotoInfoRow[]): PhotoInfoSection | null {
  return rows.length > 0 ? { id, title, rows } : null
}

function formatCoordinate(value: unknown, reference: unknown): string | null {
  const coordinate = textValue(value)
  if (!coordinate) {
    return null
  }
  const suffix = textValue(reference)
  const formatted = coordinate.includes('°') ? coordinate : `${coordinate}°`
  return suffix ? `${formatted} ${suffix}` : formatted
}

function decimalCoordinate(value: unknown, reference: unknown, limit: number): number | null {
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

function formatAltitude(exif: GalleryExif | null): string | null {
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

function cleanRecipeValue(value: unknown): string | null {
  const text = textValue(value)
  return text?.replace(/\s*\([^)]*\)$/, '').trim() || null
}

function formatFilmMode(value: unknown): string | null {
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

function formatFujiDynamicRange(recipe: GalleryFujiRecipe, t: Translator): string | null {
  if (recipe.DynamicRangeSetting === 'Manual' && recipe.DevelopmentDynamicRange) {
    return `DR${recipe.DevelopmentDynamicRange}`
  }
  if (recipe.DynamicRangeSetting === 'Auto') {
    return t('action.auto')
  }
  return textValue(recipe.DynamicRange)
}

function formatFujiWhiteBalance(recipe: GalleryFujiRecipe, t: Translator): string | null {
  if (recipe.WhiteBalance === 'Kelvin' && recipe.ColorTemperature) {
    return `${recipe.ColorTemperature} K`
  }
  return translateExifValue(t, 'exif.fujirecipe-whitebalance', recipe.WhiteBalance)
}

function buildBasicRows(photo: GalleryPhoto, exif: GalleryExif | null, t: Translator, locale: string): PhotoInfoRow[] {
  const dimensions = photo.width > 0 && photo.height > 0 ? `${photo.width} × ${photo.height}` : null
  const captureTime = formatDate(exif?.DateTimeOriginal ?? photo.dateTaken, locale)

  return createRows([
    { id: 'filename', label: t('exif.filename'), value: photo.title || null },
    { id: 'format', label: t('exif.format'), value: photo.format?.toUpperCase() ?? null },
    { id: 'dimensions', label: t('exif.dimensions'), value: dimensions },
    { id: 'file-size', label: t('exif.file.size'), value: formatFileSize(photo.size, locale) },
    {
      id: 'megapixels',
      label: t('exif.pixels'),
      value: formatMegapixels(photo.width, photo.height, locale),
    },
    {
      id: 'color-space',
      label: t('exif.color.space'),
      value: translateExifValue(t, 'exif.colorspace', exif?.ColorSpace),
    },
    { id: 'rating', label: t('exif.rating'), value: formatRating(photo.rating) },
    { id: 'capture-time', label: t('exif.capture.time'), value: captureTime },
    { id: 'time-zone', label: t('exif.time.zone'), value: textValue(exif?.zone ?? exif?.tz) },
    { id: 'artist', label: t('exif.artist'), value: textValue(exif?.Artist) },
    { id: 'copyright', label: t('exif.copyright'), value: textValue(exif?.Copyright) },
    { id: 'software', label: t('exif.software'), value: textValue(exif?.Software) },
  ])
}

function buildCaptureParameters(exif: GalleryExif | null, t: Translator, locale: string): CaptureParameter[] {
  if (!exif) {
    return []
  }

  const parameters: NullableCaptureParameter[] = [
    {
      id: 'focal-length',
      label: t(exif.FocalLengthIn35mmFormat ? 'exif.focal.length.equivalent' : 'exif.focal.length.actual'),
      value: formatFocalLength(exif.FocalLengthIn35mmFormat ?? exif.FocalLength),
    },
    { id: 'aperture', label: t('mobile.exif.aperture'), value: formatAperture(exif.FNumber) },
    {
      id: 'shutter-speed',
      label: t('mobile.exif.shutterSpeed'),
      value: formatExposureTime(exif.ExposureTime ?? exif.ShutterSpeedValue ?? exif.ShutterSpeed, locale),
    },
    { id: 'iso', label: t('mobile.exif.sensitivity'), value: exif.ISO == null ? null : `ISO ${exif.ISO}` },
    { id: 'exposure-bias', label: t('mobile.exif.exposureBias'), value: formatEv(exif.ExposureCompensation) },
  ]
  return parameters.filter((parameter): parameter is CaptureParameter => parameter.value !== null)
}

function buildDeviceSection(photo: GalleryPhoto, exif: GalleryExif | null, t: Translator): PhotoInfoSection | null {
  const lens = joinMakeAndModel(exif?.LensMake, exif?.LensModel) ?? photo.lens
  const lensMake = textValue(exif?.LensMake)

  return createSection(
    'device',
    t('exif.device.info'),
    createRows([
      { id: 'camera', label: t('exif.camera'), value: joinMakeAndModel(exif?.Make, exif?.Model) ?? photo.camera },
      { id: 'lens', label: t('exif.lens'), value: lens },
      {
        id: 'lens-make',
        label: t('exif.lensmake'),
        value: lensMake && !lens?.toLowerCase().includes(lensMake.toLowerCase()) ? lensMake : null,
      },
      { id: 'focal-length', label: t('exif.focal.length.actual'), value: formatFocalLength(exif?.FocalLength) },
      {
        id: 'focal-length-35mm',
        label: t('exif.focal.length.equivalent'),
        value: formatFocalLength(exif?.FocalLengthIn35mmFormat),
      },
      { id: 'max-aperture', label: t('exif.max.aperture'), value: formatAperture(exif?.MaxApertureValue) },
    ]),
  )
}

function buildCaptureModeSection(exif: GalleryExif, t: Translator): PhotoInfoSection | null {
  return createSection(
    'capture-mode',
    t('exif.capture.mode'),
    createRows([
      {
        id: 'exposure-program',
        label: t('exif.exposureprogram.title'),
        value: translateExifValue(t, 'exif.exposureprogram', exif.ExposureProgram),
      },
      {
        id: 'exposure-mode',
        label: t('exif.exposure.mode.title'),
        value: translateExifValue(t, 'exif.exposure.mode', exif.ExposureMode),
      },
      {
        id: 'metering-mode',
        label: t('exif.metering.mode.type'),
        value: translateExifValue(t, 'exif.metering.mode', exif.MeteringMode),
      },
      {
        id: 'white-balance',
        label: t('exif.white.balance.title'),
        value: translateExifValue(t, 'exif.white.balance', exif.WhiteBalance),
      },
      {
        id: 'white-balance-bias',
        label: t('exif.white.balance.bias'),
        value: formatMired(exif.WhiteBalanceBias),
      },
      { id: 'white-balance-ab', label: t('exif.white.balance.shift.ab'), value: textValue(exif.WBShiftAB) },
      { id: 'white-balance-gm', label: t('exif.white.balance.shift.gm'), value: textValue(exif.WBShiftGM) },
      { id: 'flash', label: t('exif.flash.title'), value: translateExifValue(t, 'exif.flash', exif.Flash) },
      {
        id: 'light-source',
        label: t('exif.light.source.type'),
        value: translateExifValue(t, 'exif.light.source', exif.LightSource),
      },
      {
        id: 'scene-type',
        label: t('exif.scene.capture.type'),
        value: translateExifValue(t, 'exif.scene.capture', exif.SceneCaptureType),
      },
      { id: 'flash-metering', label: t('exif.flash.metering.mode'), value: textValue(exif.FlashMeteringMode) },
    ]),
  )
}

function buildFujiSection(recipe: GalleryFujiRecipe | undefined, t: Translator): PhotoInfoSection | null {
  if (!recipe) {
    return null
  }

  return createSection(
    'fuji-recipe',
    t('exif.fuji.film.simulation'),
    createRows([
      { id: 'film-mode', label: t('exif.film.mode'), value: formatFilmMode(recipe.FilmMode) },
      { id: 'dynamic-range', label: t('exif.dynamic.range'), value: formatFujiDynamicRange(recipe, t) },
      { id: 'white-balance', label: t('exif.white.balance.title'), value: formatFujiWhiteBalance(recipe, t) },
      { id: 'highlight-tone', label: t('exif.highlight.tone'), value: cleanRecipeValue(recipe.HighlightTone) },
      { id: 'shadow-tone', label: t('exif.shadow.tone'), value: cleanRecipeValue(recipe.ShadowTone) },
      { id: 'saturation', label: t('exif.saturation'), value: cleanRecipeValue(recipe.Saturation) },
      {
        id: 'sharpness',
        label: t('exif.sharpness'),
        value: translateExifValue(t, 'exif.fujirecipe-sharpness', recipe.Sharpness),
      },
      { id: 'noise-reduction', label: t('exif.noise.reduction'), value: cleanRecipeValue(recipe.NoiseReduction) },
      { id: 'clarity', label: t('exif.clarity'), value: textValue(recipe.Clarity) },
      {
        id: 'color-chrome',
        label: t('exif.color.effect'),
        value: translateExifValue(t, 'exif.fujirecipe-colorchromeeffect', recipe.ColorChromeEffect),
      },
      {
        id: 'color-chrome-blue',
        label: t('exif.blue.color.effect'),
        value: translateExifValue(t, 'exif.fujirecipe-colorchromefxblue', recipe.ColorChromeFxBlue),
      },
      {
        id: 'white-balance-fine-tune',
        label: t('exif.white.balance.fine.tune'),
        value: textValue(recipe.WhiteBalanceFineTune),
      },
      {
        id: 'grain-intensity',
        label: t('exif.grain.effect.intensity'),
        value: textValue(recipe.GrainEffectRoughness),
      },
      {
        id: 'grain-size',
        label: t('exif.grain.effect.size'),
        value: translateExifValue(t, 'exif.fujirecipe-graineffectsize', recipe.GrainEffectSize),
      },
    ]),
  )
}

function buildLocationSection(photo: GalleryPhoto, exif: GalleryExif | null, t: Translator): PhotoInfoSection | null {
  const city = textValue(photo.location?.city) ?? photo.city
  const country = textValue(photo.location?.country)
  const place
    = city && country && city.localeCompare(country, undefined, { sensitivity: 'accent' }) === 0
      ? city
      : [city, country].filter(Boolean).join(', ')

  return createSection(
    'location',
    t('exif.gps.location.info'),
    createRows([
      {
        id: 'latitude',
        label: t('exif.gps.latitude'),
        value: formatCoordinate(exif?.GPSLatitude ?? photo.location?.latitude, exif?.GPSLatitudeRef),
      },
      {
        id: 'longitude',
        label: t('exif.gps.longitude'),
        value: formatCoordinate(exif?.GPSLongitude ?? photo.location?.longitude, exif?.GPSLongitudeRef),
      },
      { id: 'altitude', label: t('exif.gps.altitude'), value: formatAltitude(exif) },
      { id: 'place', label: t('exif.gps.city'), value: place || null },
      { id: 'address', label: t('exif.gps.address'), value: photo.location?.locationName ?? null },
    ]),
  )
}

function buildMapLocation(photo: GalleryPhoto, exif: GalleryExif | null): PhotoInfoMapLocation | null {
  const latitude = decimalCoordinate(exif?.GPSLatitude ?? photo.location?.latitude, exif?.GPSLatitudeRef, 90)
  const longitude = decimalCoordinate(exif?.GPSLongitude ?? photo.location?.longitude, exif?.GPSLongitudeRef, 180)

  return latitude === null || longitude === null ? null : { latitude, longitude }
}

const toneTypeKeys: Record<GalleryToneType, string> = {
  'low-key': 'exif.tone.low-key',
  'high-key': 'exif.tone.high-key',
  'normal': 'exif.tone.normal',
  'high-contrast': 'exif.tone.high-contrast',
}

function formatPercentage(value: number, scale: number): string | null {
  return Number.isFinite(value) ? `${Math.round(value * scale)}%` : null
}

function buildToneAnalysis(
  toneAnalysis: GalleryToneAnalysis | null,
  histogramUrl: string,
  t: Translator,
): PhotoInfoToneAnalysis | null {
  if (!toneAnalysis) {
    return null
  }

  return {
    histogramUrl,
    tone: {
      id: 'tone-type',
      label: t('exif.tone.type'),
      value: t(toneTypeKeys[toneAnalysis.toneType] ?? toneAnalysis.toneType),
    },
    metrics: createRows([
      {
        id: 'brightness',
        label: t('exif.brightness.title'),
        value: formatPercentage(toneAnalysis.brightness, 1),
      },
      {
        id: 'contrast',
        label: t('exif.contrast.title'),
        value: formatPercentage(toneAnalysis.contrast, 1),
      },
      {
        id: 'shadow-ratio',
        label: t('exif.shadow.ratio'),
        value: formatPercentage(toneAnalysis.shadowRatio, 100),
      },
      {
        id: 'highlight-ratio',
        label: t('exif.highlight.ratio'),
        value: formatPercentage(toneAnalysis.highlightRatio, 100),
      },
    ]),
  }
}

function buildTechnicalSection(exif: GalleryExif, t: Translator): PhotoInfoSection | null {
  const focalPlaneResolution = (() => {
    const x = textValue(exif.FocalPlaneXResolution)
    const y = textValue(exif.FocalPlaneYResolution)
    return x || y ? `${x ?? '—'} × ${y ?? '—'}` : null
  })()

  return createSection(
    'technical',
    t('exif.technical.parameters'),
    createRows([
      { id: 'brightness', label: t('exif.brightness.value'), value: formatEv(exif.BrightnessValue) },
      { id: 'shutter-value', label: t('exif.shutter.speed.value'), value: textValue(exif.ShutterSpeedValue) },
      { id: 'aperture-value', label: t('exif.aperture.value'), value: formatEv(exif.ApertureValue) },
      {
        id: 'sensing-method',
        label: t('exif.sensing.method.type'),
        value: translateExifValue(t, 'exif.sensing.method', exif.SensingMethod),
      },
      { id: 'focal-plane', label: t('exif.focal.plane.resolution'), value: focalPlaneResolution },
    ]),
  )
}

export function buildPhotoInfoModel(
  photo: GalleryPhoto,
  t: Translator = translate,
  locale = getIntlLocale(),
): PhotoInfoModel {
  const exif = photo.exif ?? null
  const sections = [
    buildDeviceSection(photo, exif, t),
    ...(exif ? [buildCaptureModeSection(exif, t), buildFujiSection(exif.FujiRecipe, t)] : []),
    buildLocationSection(photo, exif, t),
    ...(exif ? [buildTechnicalSection(exif, t)] : []),
  ].filter((section): section is PhotoInfoSection => section !== null)

  return {
    basic: {
      id: 'basic',
      title: t('exif.basic.info'),
      rows: buildBasicRows(photo, exif, t, locale),
    },
    captureParameters: buildCaptureParameters(exif, t, locale),
    hasExif: exif !== null,
    mapLocation: buildMapLocation(photo, exif),
    sections,
    toneAnalysis: buildToneAnalysis(photo.toneAnalysis, photo.thumbnailUrl, t),
  }
}
