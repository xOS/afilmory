import { requireNativeView } from 'expo'
import type { ViewProps } from 'react-native'
import { StyleSheet } from 'react-native'

import { signInPage } from '@/modules/auth/signInPage'
import { present } from '@/presentation'

type NativePage = 'explore' | 'map' | 'photos' | 'studio-library'

interface NativePageViewProps extends ViewProps {
  page: NativePage
  onRequestSignIn?: () => void
}

const NativePageHost = requireNativeView<NativePageViewProps>('NativePages')

export function NativePageView({ page }: { page: NativePage }) {
  return <NativePageHost page={page} style={styles.root} onRequestSignIn={() => void present(signInPage)} />
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
