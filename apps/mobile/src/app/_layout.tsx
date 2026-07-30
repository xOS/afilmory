import { DarkTheme, Stack, ThemeProvider } from 'expo-router'
import { useEffect, useMemo } from 'react'
import { I18nextProvider } from 'react-i18next'
import { LogBox, StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { i18n } from '@/i18n'
import { hydrateAuth } from '@/modules/auth/sessionStore'
import { PresentationHost } from '@/presentation'
import { useTheme as useAppTheme } from '@/theme/useTheme'

LogBox.ignoreAllLogs(true)

export default function RootLayout() {
  const { palette } = useAppTheme()

  useEffect(() => {
    void hydrateAuth()
  }, [])
  const navigationTheme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: palette.bgCanvas,
        border: palette.border,
        card: palette.bgCanvas,
        primary: palette.accent,
        text: palette.textPrimary,
      },
    }),
    [palette],
  )

  return (
    <I18nextProvider i18n={i18n}>
      <GestureHandlerRootView style={[styles.root, { backgroundColor: palette.bgCanvas }]}>
        <SafeAreaProvider>
          <ThemeProvider value={navigationTheme}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="photo/[photoId]"
                options={{ contentStyle: styles.photoScreen, gestureEnabled: true }}
              />
            </Stack>
            <PresentationHost />
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </I18nextProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  photoScreen: { backgroundColor: '#000' },
})
