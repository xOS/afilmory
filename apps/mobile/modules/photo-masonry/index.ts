import { requireNativeView } from 'expo'
import type { ViewProps } from 'react-native'

export interface PhotoMasonryItem {
  accessibilityLabel: string
  id: string
  url: string
  originalUrl: string
  thumbHash?: string
  aspectRatio: number
  width: number
  height: number
  livePhotoVideoUrl?: string
}

export interface PhotoPressEvent {
  id: string
  index: number
  transitionId: string
  frame: { x: number, y: number, width: number, height: number }
}

export interface PhotoViewerIndexChangeEvent {
  id: string
  index: number
}

export interface VisibleRangeEvent {
  startIndex: number
  endIndex: number
}

export interface ScrollBeyondThresholdEvent {
  beyond: boolean
}

export interface ColumnCountChangeEvent {
  columnCount: number
  preferredItemWidth: number
}

export interface SelectionChangeEvent {
  ids: string[]
}

export interface SelectionModeChangeEvent {
  active: boolean
}

export interface PhotoContextMenuActionEvent {
  action: 'info' | 'share'
  id: string
  index: number
}

export interface PresentationAnchorEvent {
  frame: { x: number, y: number, width: number, height: number }
}

export interface PhotoMapItem {
  accessibilityLabel: string
  id: string
  index: number
  latitude: number
  longitude: number
  openAccessibilityLabel: string
  subtitle: string
  thumbnailUrl: string
  title: string
}

export interface PhotoMapPressEvent {
  id: string
  index: number
}

export interface PhotoMapViewProps extends ViewProps {
  photos: PhotoMapItem[]
  state: 'empty' | 'error' | 'loading' | 'pending' | 'ready' | 'signedOut'
  stringsJSON: string
  onPhotoPress?: (event: { nativeEvent: PhotoMapPressEvent }) => void
  onRetry?: () => void
  onSignIn?: () => void
}

export interface PhotoMasonryViewProps extends ViewProps {
  photos: PhotoMasonryItem[]
  contextMenuInfoTitle: string
  contextMenuShareTitle: string
  contextMenuSelectTitle?: string
  defaultColumnCount?: number
  preferredItemWidth?: number
  gap?: number
  extraTopInset?: number
  extraBottomInset?: number
  scrollThreshold?: number
  refreshing?: boolean
  chromeVisible?: boolean
  chromeIdentityLabel?: string
  chromeDateLabel?: string
  chromeDateDetail?: string
  chromeDateVisible?: boolean
  chromeDateInteractive?: boolean
  profileImageURL?: string
  profileInitial?: string
  profileAccessibilityLabel?: string
  filterActive?: boolean
  filterAccessibilityLabel?: string
  filterCount?: number
  livePhotoBadgeTitle?: string
  selectionEnabled?: boolean
  selectionMode?: boolean
  selectedPhotoIds?: string[]
  onPhotoPress?: (event: { nativeEvent: PhotoPressEvent }) => void
  onPhotoContextMenuAction: (event: { nativeEvent: PhotoContextMenuActionEvent }) => void
  onVisibleRangeChange?: (event: { nativeEvent: VisibleRangeEvent }) => void
  onScrollBeyondThreshold?: (event: { nativeEvent: ScrollBeyondThresholdEvent }) => void
  onColumnCountChange?: (event: { nativeEvent: ColumnCountChangeEvent }) => void
  onRefresh?: () => void
  onDatePress?: (event: { nativeEvent: PresentationAnchorEvent }) => void
  onProfilePress?: (event: { nativeEvent: PresentationAnchorEvent }) => void
  onFilterPress?: (event: { nativeEvent: PresentationAnchorEvent }) => void
  onSelectionChange?: (event: { nativeEvent: SelectionChangeEvent }) => void
  onSelectionModeChange?: (event: { nativeEvent: SelectionModeChangeEvent }) => void
}

export interface PhotoViewerViewProps extends ViewProps {
  photos: PhotoMasonryItem[]
  initialIndex: number
  transitionId: string
  keyboardCloseTitle?: string
  keyboardInfoTitle?: string
  keyboardNextTitle?: string
  keyboardPreviousTitle?: string
  livePhotoAccessibilityHint?: string
  livePhotoBadgeTitle?: string
  interactiveDismissEnabled?: boolean
  onIndexChange?: (event: { nativeEvent: PhotoViewerIndexChangeEvent }) => void
  onInfoRequest?: () => void
  onRequestClose?: () => void
}

export const PhotoMasonryView = requireNativeView<PhotoMasonryViewProps>('PhotoMasonry')

export const PhotoViewerView = requireNativeView<PhotoViewerViewProps>('PhotoViewer')

export const PhotoMapView = requireNativeView<PhotoMapViewProps>('PhotoMap')
