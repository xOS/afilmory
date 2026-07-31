import { Redirect, Stack } from 'expo-router'

import { useTheme } from '@/theme/useTheme'

export default function DevLabLayout() {
  const { palette } = useTheme()

  if (!__DEV__) {
    return <Redirect href="/photos" />
  }

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.bgCanvas },
        headerLargeTitle: true,
        headerShadowVisible: false,
        headerTintColor: palette.textPrimary,
        headerTransparent: true,
        scrollEdgeEffects: { top: 'soft' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'UI Lab' }} />
    </Stack>
  )
}
