import { Stack } from 'expo-router'

import { useTheme } from '@/theme/useTheme'

export function PlaceholderTabLayout() {
  const { palette } = useTheme()

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.bgCanvas },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  )
}
