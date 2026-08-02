import { getIntlLocale, translate } from '@/i18n'
import type { GalleryExif, GalleryFujiRecipe, GalleryPhoto } from '@/modules/galleries/types'

import type { Translator } from './photoInfoFormatters'
import {
  cleanRecipeValue,
  decimalCoordinate,
  formatAltitude,
  formatCoordinate,
  formatDate,
  formatEv,
  formatFilmMode,
  formatFujiDynamicRange,
  formatFujiWhiteBalance,
  formatMired,
  formatPercentage,
  textValue,
  translateExifValue,
} from './photoInfoFormatters'
import type { PhotoInfoGear } from './photoInfoGear'
import { buildPhotoInfoGear } from './photoInfoGear'

export interface PhotoInfoRow {
  id: string
  label: string
  value: string
}

export interface PhotoInfoSection {
  id: string
  title: string
  summary: string | null
  rows: PhotoInfoRow[]
}

export interface PhotoInfoMapLocation {
  latitude: number
  longitude: number
}

export interface PhotoInfoSheetModel {
  gear: PhotoInfoGear
  description: string | null
  emptyMessage: string | null
  histogramUrl: string | null
  mapLocation: PhotoInfoMapLocation | null
  place: string | null
  sections: PhotoInfoSection[]
  tags: string[]
}

type NullablePhotoInfoRow = Omit<PhotoInfoRow, 'value'> & { value: string | null }

function createRows(rows: NullablePhotoInfoRow[]): PhotoInfoRow[] {
  return rows.filter((row): row is PhotoInfoRow => row.value !== null)
}

function createSection(
  id: string,
  title: string,
  rows: PhotoInfoRow[],
  summary: string | null = null,
): PhotoInfoSection | null {
  return rows.length > 0 ? { id, title, summary, rows } : null
}

function buildExposureSection(exif: GalleryExif, t: Translator): PhotoInfoSection | null {
  // A Fuji recipe reports white balance with colour temperature, so the plain
  // EXIF row would repeat it less precisely.
  const hasRecipe = exif.FujiRecipe !== undefined

  return createSection(
    'exposure',
    t('mobile.photoInfo.exposure'),
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
        value: hasRecipe ? null : translateExifValue(t, 'exif.white.balance', exif.WhiteBalance),
      },
      {
        id: 'white-balance-bias',
        label: t('exif.white.balance.bias'),
        value: formatMired(exif.WhiteBalanceBias),
      },
      { id: 'white-balance-ab', label: t('exif.white.balance.shift.ab'), value: textValue(exif.WBShiftAB) },
      { id: 'white-balance-gm', label: t('exif.white.balance.shift.gm'), value: textValue(exif.WBShiftGM) },
      { id: 'flash', label: t('exif.flash.title'), value: translateExifValue(t, 'exif.flash', exif.Flash) },
      { id: 'flash-metering', label: t('exif.flash.metering.mode'), value: textValue(exif.FlashMeteringMode) },
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
      { id: 'brightness', label: t('exif.brightness.value'), value: formatEv(exif.BrightnessValue) },
      {
        id: 'sensing-method',
        label: t('exif.sensing.method.type'),
        value: translateExifValue(t, 'exif.sensing.method', exif.SensingMethod),
      },
      {
        id: 'focal-plane',
        label: t('exif.focal.plane.resolution'),
        value: (() => {
          const x = textValue(exif.FocalPlaneXResolution)
          const y = textValue(exif.FocalPlaneYResolution)
          return x || y ? `${x ?? '—'} × ${y ?? '—'}` : null
        })(),
      },
    ]),
    translateExifValue(t, 'exif.exposureprogram', exif.ExposureProgram),
  )
}

function buildFujiSection(recipe: GalleryFujiRecipe | undefined, t: Translator): PhotoInfoSection | null {
  if (!recipe) {
    return null
  }

  return createSection(
    'fuji-recipe',
    t('mobile.photoInfo.filmSimulation'),
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
    formatFilmMode(recipe.FilmMode),
  )
}

function buildToneSection(photo: GalleryPhoto, t: Translator): PhotoInfoSection | null {
  const toneAnalysis = photo.toneAnalysis
  if (!toneAnalysis) {
    return null
  }

  const brightness = formatPercentage(toneAnalysis.brightness, 1)
  return createSection(
    'tone',
    t('mobile.photoInfo.tone'),
    createRows([
      { id: 'brightness', label: t('exif.brightness.title'), value: brightness },
      { id: 'contrast', label: t('exif.contrast.title'), value: formatPercentage(toneAnalysis.contrast, 1) },
      { id: 'shadow-ratio', label: t('exif.shadow.ratio'), value: formatPercentage(toneAnalysis.shadowRatio, 100) },
      {
        id: 'highlight-ratio',
        label: t('exif.highlight.ratio'),
        value: formatPercentage(toneAnalysis.highlightRatio, 100),
      },
    ]),
    brightness,
  )
}

function buildLocationSection(photo: GalleryPhoto, exif: GalleryExif | null, t: Translator): PhotoInfoSection | null {
  const altitude = formatAltitude(exif)
  return createSection(
    'location',
    t('mobile.photoInfo.locationDetail'),
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
      { id: 'altitude', label: t('exif.gps.altitude'), value: altitude },
      { id: 'address', label: t('exif.gps.address'), value: photo.location?.locationName ?? null },
    ]),
    altitude,
  )
}

function buildFileSection(
  photo: GalleryPhoto,
  exif: GalleryExif | null,
  t: Translator,
  locale: string,
): PhotoInfoSection | null {
  const filename = textValue(photo.title)
  return createSection(
    'file',
    t('mobile.photoInfo.file'),
    createRows([
      { id: 'filename', label: t('exif.filename'), value: filename },
      {
        id: 'color-space',
        label: t('exif.color.space'),
        value: translateExifValue(t, 'exif.colorspace', exif?.ColorSpace),
      },
      {
        id: 'capture-time',
        label: t('exif.capture.time'),
        value: formatDate(exif?.DateTimeOriginal ?? photo.dateTaken, locale),
      },
      { id: 'time-zone', label: t('exif.time.zone'), value: textValue(exif?.zone ?? exif?.tz) },
    ]),
    filename,
  )
}

function buildAttributionSection(exif: GalleryExif | null, t: Translator): PhotoInfoSection | null {
  const artist = textValue(exif?.Artist)
  return createSection(
    'attribution',
    t('mobile.photoInfo.attribution'),
    createRows([
      { id: 'artist', label: t('exif.artist'), value: artist },
      { id: 'copyright', label: t('exif.copyright'), value: textValue(exif?.Copyright) },
      { id: 'software', label: t('exif.software'), value: textValue(exif?.Software) },
    ]),
    artist,
  )
}

function buildMapLocation(photo: GalleryPhoto, exif: GalleryExif | null): PhotoInfoMapLocation | null {
  const latitude = decimalCoordinate(exif?.GPSLatitude ?? photo.location?.latitude, exif?.GPSLatitudeRef, 90)
  const longitude = decimalCoordinate(exif?.GPSLongitude ?? photo.location?.longitude, exif?.GPSLongitudeRef, 180)

  return latitude === null || longitude === null ? null : { latitude, longitude }
}

function buildPlace(photo: GalleryPhoto): string | null {
  const city = textValue(photo.location?.city) ?? textValue(photo.city)
  const country = textValue(photo.location?.country)
  if (city && country && city.localeCompare(country, undefined, { sensitivity: 'accent' }) === 0) {
    return city
  }
  return [city, country].filter(Boolean).join(', ') || null
}

export function buildPhotoInfoSheetModel(
  photo: GalleryPhoto,
  t: Translator = translate,
  locale = getIntlLocale(),
): PhotoInfoSheetModel {
  const exif = photo.exif ?? null
  const sections = [
    ...(exif ? [buildExposureSection(exif, t), buildFujiSection(exif.FujiRecipe, t)] : []),
    buildToneSection(photo, t),
    buildLocationSection(photo, exif, t),
    buildFileSection(photo, exif, t, locale),
    buildAttributionSection(exif, t),
  ].filter((section): section is PhotoInfoSection => section !== null)

  return {
    gear: buildPhotoInfoGear(photo, exif, t, locale),
    description: photo.description || null,
    emptyMessage: exif ? null : t('photo.noExif'),
    histogramUrl: photo.toneAnalysis ? photo.thumbnailUrl : null,
    mapLocation: buildMapLocation(photo, exif),
    place: buildPlace(photo),
    sections,
    tags: photo.tags,
  }
}
