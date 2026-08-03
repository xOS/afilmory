import { requireNativeView } from 'expo'
import { useRouter } from 'expo-router'
import { useCallback } from 'react'
import type { ViewProps } from 'react-native'
import { StyleSheet } from 'react-native'

import { signOut, synchronizeWorkspaceFromNative } from '@/modules/auth/sessionStore'
import { signInPage } from '@/modules/auth/signInPage'
import { present } from '@/presentation'

type NativePage = 'explore' | 'map' | 'photos' | 'studio-home' | 'studio-library'
type StudioPath = '/studio/analytics' | '/studio/comments' | '/studio/library' | '/studio/operations' | '/studio/site'

interface NativeNavigationEvent {
  nativeEvent: {
    path: StudioPath
  }
}

type NativeAuthChangeEvent
  = | { nativeEvent: { type: 'signOut' } }
    | { nativeEvent: { type: 'workspaceChanged', workspaceSlug: string } }

interface NativePageViewProps extends ViewProps {
  galleryRoute?: string
  page: NativePage
  onAuthChange?: (event: NativeAuthChangeEvent) => void
  onNavigate?: (event: NativeNavigationEvent) => void
  onRequestSignIn?: () => void
}

const NativePageHost = requireNativeView<NativePageViewProps>('NativePages')

export function NativePageView({ galleryRoute, page }: { galleryRoute?: string, page: NativePage }) {
  const router = useRouter()
  const navigate = useCallback((event: NativeNavigationEvent) => router.push(event.nativeEvent.path), [router])
  const handleAuthChange = useCallback((event: NativeAuthChangeEvent) => {
    if (event.nativeEvent.type === 'signOut') {
      void signOut()
      return
    }
    void synchronizeWorkspaceFromNative(event.nativeEvent.workspaceSlug)
  }, [])

  return (
    <NativePageHost
      galleryRoute={galleryRoute}
      page={page}
      style={styles.root}
      onAuthChange={handleAuthChange}
      onNavigate={navigate}
      onRequestSignIn={() => void present(signInPage)}
    />
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
