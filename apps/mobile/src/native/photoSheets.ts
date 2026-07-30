import { requireNativeModule } from 'expo'

import { translate } from '@/i18n'
import type {
  CaptureParameter,
  PhotoInfoMapLocation,
  PhotoInfoSection,
  PhotoInfoToneAnalysis,
} from '@/modules/photo-viewer/photoInfoModel'
import type { FilterOptions } from '@/modules/photos/filters/aggregates'
import type { PhotoFilters } from '@/modules/photos/filters/filterTypes'
import { DATE_PRESET_KEYS } from '@/modules/photos/filters/filterTypes'

export interface NativePhotoInfoSheet {
  title: string
  description: string | null
  sections: PhotoInfoSection[]
  captureParameters: CaptureParameter[]
  tags: string[]
  toneAnalysis: PhotoInfoToneAnalysis | null
  mapLocation: PhotoInfoMapLocation | null
  emptyMessage: string | null
}

interface NativePhotoInfoLocalization {
  captureParameters: string
  done: string
  histogram: string
  histogramAccessibilityLabel: string
  histogramFailure: string
  mapAccessibilityLabel: string
  tags: string
  title: string
  toneAnalysis: string
}

interface NativePhotoInfoSheetPayload extends NativePhotoInfoSheet {
  localization: NativePhotoInfoLocalization
}

interface NativePhotoFilterLocalization {
  all: string
  any: string
  anyDate: string
  anyRating: string
  camera: string
  cancel: string
  customRange: string
  date: string
  datePresets: Array<{ label: string, value: string }>
  done: string
  from: string
  lens: string
  match: string
  minimumRating: string
  notSelected: string
  range: string
  rating: string
  ratingOptions: string[]
  reset: string
  selected: string
  tags: string
  title: string
  to: string
}

interface NativePhotoFilterSheetRequest {
  filters: PhotoFilters
  localization: NativePhotoFilterLocalization
  options: FilterOptions
}

interface PhotoSheetsNativeModule {
  presentPhotoInfo: (info: NativePhotoInfoSheetPayload) => Promise<void>
  presentPhotoFilters: (request: NativePhotoFilterSheetRequest) => Promise<PhotoFilters | null>
}

const nativePhotoSheets = requireNativeModule('PhotoSheets') as PhotoSheetsNativeModule

export function presentNativePhotoInfo(info: NativePhotoInfoSheet): Promise<void> {
  const mapAccessibilityLabel = info.mapLocation
    ? translate('sheet.map.accessibility', {
        latitude: info.mapLocation.latitude,
        longitude: info.mapLocation.longitude,
      })
    : ''
  return nativePhotoSheets.presentPhotoInfo({
    ...info,
    localization: {
      captureParameters: translate('exif.capture.parameters'),
      done: translate('common.done'),
      histogram: translate('exif.histogram'),
      histogramAccessibilityLabel: translate('sheet.histogram.accessibility'),
      histogramFailure: translate('sheet.histogram.failed'),
      mapAccessibilityLabel,
      tags: translate('exif.tags'),
      title: translate('sheet.info'),
      toneAnalysis: translate('exif.tone.analysis.title'),
    },
  })
}

export function presentNativePhotoFilters(filters: PhotoFilters, options: FilterOptions): Promise<PhotoFilters | null> {
  return nativePhotoSheets.presentPhotoFilters({
    filters,
    localization: {
      all: translate('filter.all'),
      any: translate('filter.any'),
      anyDate: translate('filter.anyDate'),
      anyRating: translate('filter.anyRating'),
      camera: translate('exif.camera'),
      cancel: translate('common.cancel'),
      customRange: translate('filter.customRange'),
      date: translate('action.date.label'),
      datePresets: Object.entries(DATE_PRESET_KEYS).map(([value, key]) => ({ label: translate(key), value })),
      done: translate('common.done'),
      from: translate('action.date.from'),
      lens: translate('exif.lens'),
      match: translate('filter.match'),
      minimumRating: translate('filter.minimumRating'),
      notSelected: translate('filter.notSelected'),
      range: translate('filter.range'),
      rating: translate('exif.rating'),
      ratingOptions: Array.from({ length: 5 }, (_, index) => translate('filter.ratingOrBetter', { count: index + 1 })),
      reset: translate('filter.reset'),
      selected: translate('filter.selected'),
      tags: translate('exif.tags'),
      title: translate('action.filter.title'),
      to: translate('action.date.to'),
    },
    options,
  })
}
