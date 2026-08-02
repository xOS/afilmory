import type { GalleryExif, GalleryPhoto } from '@/modules/galleries/types'

import type { Translator } from './photoInfoFormatters'
import {
  formatApertureGlyph,
  formatDimensions,
  formatExposureBias,
  formatExposureTime,
  formatFileSize,
  formatFilmMode,
  formatFocalPair,
  formatIso,
  formatMegapixels,
  formatToneType,
  joinMakeAndModel,
  textValue,
} from './photoInfoFormatters'

export interface PhotoInfoGear {
  model: string
  formatBadge: string | null
  styleBadge: string | null
  lens: string | null
  rating: number
  specs: string[]
  tone: string | null
  exposure: string[]
}

function compact(values: (string | null)[]): string[] {
  return values.filter((value): value is string => value !== null)
}

export function buildPhotoInfoGear(
  photo: GalleryPhoto,
  exif: GalleryExif | null,
  t: Translator,
  locale: string,
): PhotoInfoGear {
  const lens = joinMakeAndModel(exif?.LensMake, exif?.LensModel) ?? textValue(photo.lens)
  const model = joinMakeAndModel(exif?.Make, exif?.Model) ?? textValue(photo.camera) ?? textValue(photo.title) ?? ''

  return {
    model,
    formatBadge: textValue(photo.format)?.toUpperCase() ?? null,
    styleBadge: formatFilmMode(exif?.FujiRecipe?.FilmMode),
    lens,
    rating: Math.min(5, Math.max(0, Math.round(photo.rating ?? 0))),
    specs: compact([
      formatMegapixels(photo.width, photo.height, locale),
      formatDimensions(photo.width, photo.height),
      formatFileSize(photo.size, locale),
    ]),
    tone: formatToneType(photo.toneAnalysis, t),
    exposure: compact([
      formatIso(exif?.ISO),
      formatFocalPair(exif?.FocalLength, exif?.FocalLengthIn35mmFormat),
      formatExposureBias(exif?.ExposureCompensation, locale),
      formatApertureGlyph(exif?.FNumber),
      formatExposureTime(exif?.ExposureTime ?? exif?.ShutterSpeedValue ?? exif?.ShutterSpeed, locale),
    ]),
  }
}
