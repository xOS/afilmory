import { requireNativeModule, requireNativeView } from 'expo'
import type { ViewProps } from 'react-native'

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

export interface NativePresentationAnchor {
  x: number
  y: number
  width: number
  height: number
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

export interface NativePhotoInfoSheetPayload extends NativePhotoInfoSheet {
  localization: NativePhotoInfoLocalization
}

export interface NativePhotoInfoPanelProps extends ViewProps {
  infoJSON: string
  showsHeader?: boolean
  onClose?: () => void
}

interface NativePhotoFilterDatePreset {
  label: string
  value: string
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
  datePresets: NativePhotoFilterDatePreset[]
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
  anchor?: NativePresentationAnchor
  filters: PhotoFilters
  localization: NativePhotoFilterLocalization
  options: FilterOptions
}

export interface NativeProfileStripItem {
  url: string
  thumbHash: string | null
  aspectRatio: number
}

export interface NativeProfileSheet {
  userName: string
  avatarUrl: string
  avatarInitial: string
  tenantLine: string
  webUrl: string
  statsLine: string
  strip: NativeProfileStripItem[]
}

interface NativeProfileLocalization {
  cacheCleared: string
  cancel: string
  clearCache: string
  done: string
  openWeb: string
  signOut: string
  signOutConfirmTitle: string
  sponsorDescription: string
  sponsorFailedMessage: string
  sponsorFailedTitle: string
  sponsorPending: string
  sponsorThanks: string
  sponsorTitle: string
  sponsorUnavailable: string
}

interface NativeProfileSheetPayload extends NativeProfileSheet {
  anchor?: NativePresentationAnchor
  localization: NativeProfileLocalization
}

export type NativeProfileAction = 'signOut'

export interface NativeUploadReviewItem {
  id: string
  isLivePhoto: boolean
}

export interface NativeUploadReviewResult {
  action: 'addMore' | 'start'
  itemIds: string[]
  tags: string[]
}

interface NativeUploadReviewLocalization {
  addMore: string
  cancel: string
  remove: string
  startOne: string
  startOther: string
  summaryOne: string
  summaryOther: string
  tagsLabel: string
  tagsPlaceholder: string
  title: string
}

interface NativeUploadReviewRequest {
  items: NativeUploadReviewItem[]
  initialTags: string[]
  suggestedTags: string[]
  localization: NativeUploadReviewLocalization
}

interface PhotoSheetsNativeModule {
  presentPhotoInfo: (info: NativePhotoInfoSheetPayload) => Promise<void>
  presentPhotoFilters: (request: NativePhotoFilterSheetRequest) => Promise<PhotoFilters | null>
  presentProfile: (profile: NativeProfileSheetPayload) => Promise<NativeProfileAction | null>
  presentUploadReview: (request: NativeUploadReviewRequest) => Promise<NativeUploadReviewResult | null>
}

const nativePhotoSheets = requireNativeModule('PhotoSheets') as PhotoSheetsNativeModule
export const NativePhotoInfoPanel = requireNativeView<NativePhotoInfoPanelProps>('PhotoSheets')

export function buildNativePhotoInfoPayload(info: NativePhotoInfoSheet): NativePhotoInfoSheetPayload {
  const mapAccessibilityLabel = info.mapLocation
    ? translate('sheet.map.accessibility', {
        latitude: info.mapLocation.latitude,
        longitude: info.mapLocation.longitude,
      })
    : ''
  return {
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
  }
}

export function presentNativePhotoInfo(info: NativePhotoInfoSheet): Promise<void> {
  return nativePhotoSheets.presentPhotoInfo(buildNativePhotoInfoPayload(info))
}

export function presentNativePhotoFilters(
  filters: PhotoFilters,
  options: FilterOptions,
  anchor?: NativePresentationAnchor,
): Promise<PhotoFilters | null> {
  return nativePhotoSheets.presentPhotoFilters({
    anchor,
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

export function presentNativeUploadReview(
  items: NativeUploadReviewItem[],
  initialTags: string[],
  suggestedTags: string[],
): Promise<NativeUploadReviewResult | null> {
  return nativePhotoSheets.presentUploadReview({
    initialTags,
    items,
    // The native sheet mutates the item count as thumbnails are removed, so it
    // receives raw {count} templates rather than pre-rendered strings.
    localization: {
      addMore: translate('studio.upload.review.addMore'),
      cancel: translate('common.cancel'),
      remove: translate('studio.upload.review.remove'),
      startOne: translate('studio.upload.review.startTemplate_one'),
      startOther: translate('studio.upload.review.startTemplate_other'),
      summaryOne: translate('studio.upload.review.summaryTemplate_one'),
      summaryOther: translate('studio.upload.review.summaryTemplate_other'),
      tagsLabel: translate('studio.upload.review.tagsLabel'),
      tagsPlaceholder: translate('studio.upload.review.tagsPlaceholder'),
      title: translate('studio.upload.review.title'),
    },
    suggestedTags,
  })
}

export function presentNativeProfile(
  profile: NativeProfileSheet,
  anchor?: NativePresentationAnchor,
): Promise<NativeProfileAction | null> {
  return nativePhotoSheets.presentProfile({
    ...profile,
    anchor,
    localization: {
      cacheCleared: translate('profile.cacheCleared'),
      cancel: translate('common.cancel'),
      clearCache: translate('profile.clearCache'),
      done: translate('common.done'),
      openWeb: translate('common.openGalleryWeb'),
      signOut: translate('common.signOut'),
      signOutConfirmTitle: translate('profile.signOutConfirmTitle'),
      sponsorDescription: translate('profile.sponsor.description'),
      sponsorFailedMessage: translate('profile.sponsor.failedMessage'),
      sponsorFailedTitle: translate('profile.sponsor.failedTitle'),
      sponsorPending: translate('profile.sponsor.pending'),
      sponsorThanks: translate('profile.sponsor.thanks'),
      sponsorTitle: translate('profile.sponsor.title'),
      sponsorUnavailable: translate('profile.sponsor.unavailable'),
    },
  })
}
