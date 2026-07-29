import { requireNativeView } from 'expo'
import type { ComponentType } from 'react'
import type { ViewProps } from 'react-native'
import { Platform } from 'react-native'

export interface PhotoMasonryItem {
  id: string
  url: string
  thumbHash: string | null
  aspectRatio: number
  isLive: boolean
}

export interface PhotoPressEvent {
  id: string
  index: number
  frame: { x: number, y: number, width: number, height: number }
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
  onPhotoPress?: (event: { nativeEvent: PhotoPressEvent }) => void
  onVisibleRangeChange?: (event: { nativeEvent: VisibleRangeEvent }) => void
  onScrollBeyondThreshold?: (event: { nativeEvent: ScrollBeyondThresholdEvent }) => void
  onColumnCountChange?: (event: { nativeEvent: ColumnCountChangeEvent }) => void
  onRefresh?: () => void
}

export const isPhotoMasonryAvailable = Platform.OS === 'ios'

const PhotoMasonryUnavailable: ComponentType<PhotoMasonryViewProps> = () => null

export const PhotoMasonryView: ComponentType<PhotoMasonryViewProps> = isPhotoMasonryAvailable
  ? requireNativeView<PhotoMasonryViewProps>('PhotoMasonry')
  : PhotoMasonryUnavailable
