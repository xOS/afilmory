import { requireNativeView } from 'expo'
import type { ViewProps } from 'react-native'

export interface PhotoMasonryViewProps extends ViewProps {
  feedKey: string
  appliesFilters?: boolean
}

export const PhotoMasonryView = requireNativeView<PhotoMasonryViewProps>('PhotoMasonry')
