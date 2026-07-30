import type { GalleryExif, GalleryFujiRecipe, GalleryPhoto } from '@/modules/galleries/types'

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

export interface PhotoInfoModel {
  basic: PhotoInfoSection
  captureParameters: CaptureParameter[]
  hasExif: boolean
  sections: PhotoInfoSection[]
}

type NullablePhotoInfoRow = Omit<PhotoInfoRow, 'value'> & { value: string | null }
type NullableCaptureParameter = Omit<CaptureParameter, 'value'> & { value: string | null }

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'long',
  timeStyle: 'medium',
})
const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const preciseNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return null
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

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return (maximumFractionDigits > 1 ? preciseNumberFormatter : numberFormatter).format(value)
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date)
}

function formatFileSize(value: number | null): string | null {
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
  return `${formatNumber(size)} ${units[unitIndex]}`
}

function formatMegapixels(width: number, height: number): string | null {
  if (width <= 0 || height <= 0) {
    return null
  }
  return `${formatNumber((width * height) / 1_000_000)} MP`
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

function formatExposureTime(value: unknown): string | null {
  const numeric = numberValue(value)
  if (numeric !== null && numeric > 0) {
    if (numeric < 1) {
      return `1/${Math.round(1 / numeric)} s`
    }
    return `${formatNumber(numeric, 2)} s`
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

function formatFujiDynamicRange(recipe: GalleryFujiRecipe): string | null {
  if (recipe.DynamicRangeSetting === 'Manual' && recipe.DevelopmentDynamicRange) {
    return `DR${recipe.DevelopmentDynamicRange}`
  }
  if (recipe.DynamicRangeSetting === 'Auto') {
    return 'Auto'
  }
  return textValue(recipe.DynamicRange)
}

function formatFujiWhiteBalance(recipe: GalleryFujiRecipe): string | null {
  if (recipe.WhiteBalance === 'Kelvin' && recipe.ColorTemperature) {
    return `${recipe.ColorTemperature} K`
  }
  return textValue(recipe.WhiteBalance)
}

function buildBasicRows(photo: GalleryPhoto, exif: GalleryExif | null): PhotoInfoRow[] {
  const dimensions = photo.width > 0 && photo.height > 0 ? `${photo.width} × ${photo.height}` : null
  const captureTime = formatDate(exif?.DateTimeOriginal ?? photo.dateTaken)

  return createRows([
    { id: 'filename', label: 'Filename', value: photo.title || null },
    { id: 'format', label: 'Format', value: photo.format?.toUpperCase() ?? null },
    { id: 'dimensions', label: 'Dimensions', value: dimensions },
    { id: 'file-size', label: 'File size', value: formatFileSize(photo.size) },
    { id: 'megapixels', label: 'Resolution', value: formatMegapixels(photo.width, photo.height) },
    { id: 'color-space', label: 'Color space', value: textValue(exif?.ColorSpace) },
    { id: 'rating', label: 'Rating', value: formatRating(photo.rating) },
    { id: 'capture-time', label: 'Capture time', value: captureTime },
    { id: 'time-zone', label: 'Time zone', value: textValue(exif?.zone ?? exif?.tz) },
    { id: 'artist', label: 'Artist', value: textValue(exif?.Artist) },
    { id: 'copyright', label: 'Copyright', value: textValue(exif?.Copyright) },
    { id: 'software', label: 'Software', value: textValue(exif?.Software) },
  ])
}

function buildCaptureParameters(exif: GalleryExif | null): CaptureParameter[] {
  if (!exif) {
    return []
  }

  const parameters: NullableCaptureParameter[] = [
    {
      id: 'focal-length',
      label: exif.FocalLengthIn35mmFormat ? '35mm equivalent' : 'Focal length',
      value: formatFocalLength(exif.FocalLengthIn35mmFormat ?? exif.FocalLength),
    },
    { id: 'aperture', label: 'Aperture', value: formatAperture(exif.FNumber) },
    {
      id: 'shutter-speed',
      label: 'Shutter speed',
      value: formatExposureTime(exif.ExposureTime ?? exif.ShutterSpeed),
    },
    { id: 'iso', label: 'Sensitivity', value: exif.ISO == null ? null : `ISO ${exif.ISO}` },
    { id: 'exposure-bias', label: 'Exposure bias', value: formatEv(exif.ExposureCompensation) },
  ]
  return parameters.filter((parameter): parameter is CaptureParameter => parameter.value !== null)
}

function buildDeviceSection(photo: GalleryPhoto, exif: GalleryExif | null): PhotoInfoSection | null {
  const lens = joinMakeAndModel(exif?.LensMake, exif?.LensModel) ?? photo.lens
  const lensMake = textValue(exif?.LensMake)

  return createSection(
    'device',
    'Camera & Lens',
    createRows([
      { id: 'camera', label: 'Camera', value: joinMakeAndModel(exif?.Make, exif?.Model) ?? photo.camera },
      { id: 'lens', label: 'Lens', value: lens },
      {
        id: 'lens-make',
        label: 'Lens make',
        value: lensMake && !lens?.toLowerCase().includes(lensMake.toLowerCase()) ? lensMake : null,
      },
      { id: 'focal-length', label: 'Focal length', value: formatFocalLength(exif?.FocalLength) },
      {
        id: 'focal-length-35mm',
        label: '35mm equivalent',
        value: formatFocalLength(exif?.FocalLengthIn35mmFormat),
      },
      { id: 'max-aperture', label: 'Maximum aperture', value: formatAperture(exif?.MaxApertureValue) },
    ]),
  )
}

function buildCaptureModeSection(exif: GalleryExif): PhotoInfoSection | null {
  return createSection(
    'capture-mode',
    'Capture Mode',
    createRows([
      { id: 'exposure-program', label: 'Exposure program', value: textValue(exif.ExposureProgram) },
      { id: 'exposure-mode', label: 'Exposure mode', value: textValue(exif.ExposureMode) },
      { id: 'metering-mode', label: 'Metering mode', value: textValue(exif.MeteringMode) },
      { id: 'white-balance', label: 'White balance', value: textValue(exif.WhiteBalance) },
      {
        id: 'white-balance-bias',
        label: 'White balance bias',
        value: textValue(exif.WhiteBalanceBias),
      },
      { id: 'white-balance-ab', label: 'White balance A/B', value: textValue(exif.WBShiftAB) },
      { id: 'white-balance-gm', label: 'White balance G/M', value: textValue(exif.WBShiftGM) },
      { id: 'flash', label: 'Flash', value: textValue(exif.Flash) },
      { id: 'light-source', label: 'Light source', value: textValue(exif.LightSource) },
      { id: 'scene-type', label: 'Scene type', value: textValue(exif.SceneCaptureType) },
      { id: 'flash-metering', label: 'Flash metering', value: textValue(exif.FlashMeteringMode) },
    ]),
  )
}

function buildFujiSection(recipe: GalleryFujiRecipe | undefined): PhotoInfoSection | null {
  if (!recipe) {
    return null
  }

  return createSection(
    'fuji-recipe',
    'Fuji Film Simulation',
    createRows([
      { id: 'film-mode', label: 'Film mode', value: formatFilmMode(recipe.FilmMode) },
      { id: 'dynamic-range', label: 'Dynamic range', value: formatFujiDynamicRange(recipe) },
      { id: 'white-balance', label: 'White balance', value: formatFujiWhiteBalance(recipe) },
      { id: 'highlight-tone', label: 'Highlight tone', value: cleanRecipeValue(recipe.HighlightTone) },
      { id: 'shadow-tone', label: 'Shadow tone', value: cleanRecipeValue(recipe.ShadowTone) },
      { id: 'saturation', label: 'Saturation', value: cleanRecipeValue(recipe.Saturation) },
      { id: 'sharpness', label: 'Sharpness', value: textValue(recipe.Sharpness) },
      { id: 'noise-reduction', label: 'Noise reduction', value: cleanRecipeValue(recipe.NoiseReduction) },
      { id: 'clarity', label: 'Clarity', value: textValue(recipe.Clarity) },
      { id: 'color-chrome', label: 'Color chrome effect', value: textValue(recipe.ColorChromeEffect) },
      { id: 'color-chrome-blue', label: 'Blue color effect', value: textValue(recipe.ColorChromeFxBlue) },
      {
        id: 'white-balance-fine-tune',
        label: 'White balance fine tune',
        value: textValue(recipe.WhiteBalanceFineTune),
      },
      { id: 'grain-intensity', label: 'Grain intensity', value: textValue(recipe.GrainEffectRoughness) },
      { id: 'grain-size', label: 'Grain size', value: textValue(recipe.GrainEffectSize) },
    ]),
  )
}

function buildLocationSection(photo: GalleryPhoto, exif: GalleryExif | null): PhotoInfoSection | null {
  const city = textValue(photo.location?.city) ?? photo.city
  const country = textValue(photo.location?.country)
  const place
    = city && country && city.localeCompare(country, undefined, { sensitivity: 'accent' }) === 0
      ? city
      : [city, country].filter(Boolean).join(', ')

  return createSection(
    'location',
    'Location',
    createRows([
      {
        id: 'latitude',
        label: 'Latitude',
        value: formatCoordinate(exif?.GPSLatitude ?? photo.location?.latitude, exif?.GPSLatitudeRef),
      },
      {
        id: 'longitude',
        label: 'Longitude',
        value: formatCoordinate(exif?.GPSLongitude ?? photo.location?.longitude, exif?.GPSLongitudeRef),
      },
      { id: 'altitude', label: 'Altitude', value: formatAltitude(exif) },
      { id: 'place', label: 'City', value: place || null },
      { id: 'address', label: 'Address', value: photo.location?.locationName ?? null },
    ]),
  )
}

function buildTechnicalSection(exif: GalleryExif): PhotoInfoSection | null {
  const focalPlaneResolution = (() => {
    const x = textValue(exif.FocalPlaneXResolution)
    const y = textValue(exif.FocalPlaneYResolution)
    return x || y ? `${x ?? '—'} × ${y ?? '—'}` : null
  })()

  return createSection(
    'technical',
    'Technical Details',
    createRows([
      { id: 'brightness', label: 'Brightness value', value: formatEv(exif.BrightnessValue) },
      { id: 'shutter-value', label: 'Shutter speed value', value: textValue(exif.ShutterSpeedValue) },
      { id: 'aperture-value', label: 'Aperture value', value: formatEv(exif.ApertureValue) },
      { id: 'sensing-method', label: 'Sensing method', value: textValue(exif.SensingMethod) },
      { id: 'focal-plane', label: 'Focal plane resolution', value: focalPlaneResolution },
    ]),
  )
}

export function buildPhotoInfoModel(photo: GalleryPhoto): PhotoInfoModel {
  const exif = photo.exif
  const sections = [
    buildDeviceSection(photo, exif),
    ...(exif ? [buildCaptureModeSection(exif), buildFujiSection(exif.FujiRecipe), buildTechnicalSection(exif)] : []),
    buildLocationSection(photo, exif),
  ].filter((section): section is PhotoInfoSection => section !== null)

  return {
    basic: {
      id: 'basic',
      title: 'Basic Information',
      rows: buildBasicRows(photo, exif),
    },
    captureParameters: buildCaptureParameters(exif),
    hasExif: exif !== null,
    sections,
  }
}
