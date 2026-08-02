import { requireNativeModule } from 'expo'

import type { NativePresentationAnchor } from './photoSheets'

export interface NativePhotoSidebarItem {
  count: number
  id: string
  label: string
  selected: boolean
}

export interface NativePhotoSidebarLocalization {
  clearFilters: string
  filters: string
  moreTags: string
  notSelected: string
  quickFilters: string
  selected: string
  tags: string
}

export interface NativePhotoSidebarRequest {
  activeFilterCount: number
  localization: NativePhotoSidebarLocalization
  ownerID: string
  quickFilters: NativePhotoSidebarItem[]
  showsMoreTags: boolean
  tags: NativePhotoSidebarItem[]
}

interface SidebarItemPressEvent {
  id: string
  ownerID: string
}

interface SidebarOwnerEvent {
  ownerID: string
}

interface SidebarFiltersPressEvent extends SidebarOwnerEvent {
  frame: NativePresentationAnchor
}

interface SidebarContentLayoutEvent {
  containerWidth: number
  contentWidth: number
  trailingInset: number
}

interface NativeEventSubscription {
  remove: () => void
}

interface PhotoSidebarEventMap {
  onClearFilters: SidebarOwnerEvent
  onContentLayoutChange: SidebarContentLayoutEvent
  onFiltersPress: SidebarFiltersPressEvent
  onQuickFilterPress: SidebarItemPressEvent
  onTagPress: SidebarItemPressEvent
}

interface PhotoSidebarNativeModule {
  configure: (request: NativePhotoSidebarRequest) => Promise<void>
  clear: (ownerID: string) => Promise<void>
  setTiledLayout: () => Promise<void>
  addListener: <Event extends keyof PhotoSidebarEventMap>(
    event: Event,
    listener: (event: PhotoSidebarEventMap[Event]) => void,
  ) => NativeEventSubscription
}

export const nativePhotoSidebar = requireNativeModule<PhotoSidebarNativeModule>('PhotoSidebar')
