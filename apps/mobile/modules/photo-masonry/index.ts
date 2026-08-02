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

interface NativeViewFrame {
  height: number
  width: number
  x: number
  y: number
}

export interface PhotoPressEvent {
  id: string
  index: number
  transitionId: string
  frame: NativeViewFrame
}

export interface PhotoViewerIndexChangeEvent {
  id: string
  index: number
}

export interface PhotoViewerInfoGestureEvent {
  state: 'began' | 'cancelled' | 'changed' | 'ended'
  translationY: number
  velocityY: number
}

export interface PhotoDetailIndexChangeEvent {
  id: string
  index: number
}

export interface PhotoDetailActionEvent {
  id: string
  index: number
}

export interface PhotoDetailReactionEvent extends PhotoDetailActionEvent {
  count: number
  reaction: string
}

export interface PhotoDetailMetadataItem {
  id: string
  infoJSON: string
  subtitle: string
  title: string
}

export interface PhotoDetailReactionItem {
  accessibilityLabel: string
  count: number
  reaction: string
}

export interface PhotoDetailStrings {
  close: string
  comments: string
  info: string
  next: string
  previous: string
  reaction: string
  share: string
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
  frame: NativeViewFrame
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
  state: 'empty' | 'error' | 'filteredEmpty' | 'loading' | 'pending' | 'ready' | 'signedOut'
  stringsJSON: string
  onClearFilters?: () => void
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
  livePhotoAccessibilityLabel?: string
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
  livePhotoStringsJSON?: string
  infoPresented?: boolean
  interactiveDismissEnabled?: boolean
  onIndexChange?: (event: { nativeEvent: PhotoViewerIndexChangeEvent }) => void
  onInfoGesture?: (event: { nativeEvent: PhotoViewerInfoGestureEvent }) => void
  onInfoRequest?: () => void
  onRequestClose?: () => void
}

export interface NativePhotoDetailViewProps extends ViewProps {
  photos: PhotoMasonryItem[]
  initialIndex: number
  transitionId: string
  metadataJSON: string
  stringsJSON: string
  livePhotoStringsJSON: string
  commentCount: number
  reactionItemsJSON: string
  reactionFailureNonce: number
  socialActionsEnabled: boolean
  onCommentsRequest?: (event: { nativeEvent: PhotoDetailActionEvent }) => void
  onIndexChange?: (event: { nativeEvent: PhotoDetailIndexChangeEvent }) => void
  onReactionRequest?: (event: { nativeEvent: PhotoDetailReactionEvent }) => void
  onRequestClose?: () => void
}

export const PhotoMasonryView = requireNativeView<PhotoMasonryViewProps>('PhotoMasonry')

export const PhotoViewerView = requireNativeView<PhotoViewerViewProps>('PhotoViewer')

export const NativePhotoDetailView = requireNativeView<NativePhotoDetailViewProps>('PhotoDetail')

export const PhotoMapView = requireNativeView<PhotoMapViewProps>('PhotoMap')
