import { requireNativeModule } from 'expo'

import type { CaptureParameter, PhotoInfoSection } from '@/modules/photo-viewer/photoInfoModel'
import type { FilterOptions } from '@/modules/photos/filters/aggregates'
import type { PhotoFilters } from '@/modules/photos/filters/filterTypes'

export interface NativePhotoInfoSheet {
  title: string
  description: string | null
  sections: PhotoInfoSection[]
  captureParameters: CaptureParameter[]
  tags: string[]
  emptyMessage: string | null
}

interface NativePhotoFilterSheetRequest {
  filters: PhotoFilters
  options: FilterOptions
}

interface PhotoSheetsNativeModule {
  presentPhotoInfo: (info: NativePhotoInfoSheet) => Promise<void>
  presentPhotoFilters: (request: NativePhotoFilterSheetRequest) => Promise<PhotoFilters | null>
}

const nativePhotoSheets = requireNativeModule('PhotoSheets') as PhotoSheetsNativeModule

export function presentNativePhotoInfo(info: NativePhotoInfoSheet): Promise<void> {
  return nativePhotoSheets.presentPhotoInfo(info)
}

export function presentNativePhotoFilters(filters: PhotoFilters, options: FilterOptions): Promise<PhotoFilters | null> {
  return nativePhotoSheets.presentPhotoFilters({ filters, options })
}
