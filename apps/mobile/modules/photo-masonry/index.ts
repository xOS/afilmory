import { requireNativeView } from 'expo'
import type { ViewProps } from 'react-native'

export interface PhotoMasonryItem {
  accessibilityLabel: string
  id: string
  url: string
  originalUrl: string
  thumbHash: string | null
  aspectRatio: number
  width: number
  height: number
  isLive: boolean
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
}

export interface PhotoMasonryViewProps extends ViewProps {
  photos: PhotoMasonryItem[]
  defaultColumnCount?: number
  gap?: number
  extraTopInset?: number
  extraBottomInset?: number
  scrollThreshold?: number
  refreshing?: boolean
  chromeVisible?: boolean
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
  onPhotoPress?: (event: { nativeEvent: PhotoPressEvent }) => void
  onVisibleRangeChange?: (event: { nativeEvent: VisibleRangeEvent }) => void
  onScrollBeyondThreshold?: (event: { nativeEvent: ScrollBeyondThresholdEvent }) => void
  onColumnCountChange?: (event: { nativeEvent: ColumnCountChangeEvent }) => void
  onRefresh?: () => void
  onDatePress?: () => void
  onProfilePress?: () => void
  onFilterPress?: () => void
}

export interface PhotoViewerViewProps extends ViewProps {
  photos: PhotoMasonryItem[]
  initialIndex: number
  transitionId: string
  onIndexChange?: (event: { nativeEvent: PhotoViewerIndexChangeEvent }) => void
}

export const PhotoMasonryView = requireNativeView<PhotoMasonryViewProps>('PhotoMasonry')

export const PhotoViewerView = requireNativeView<PhotoViewerViewProps>('PhotoViewer')
