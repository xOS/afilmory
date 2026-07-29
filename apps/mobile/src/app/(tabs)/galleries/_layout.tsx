import { Stack } from 'expo-router'

import { useTheme } from '@/theme/useTheme'

export default function GalleriesLayout() {
  const { palette } = useTheme()

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.bgCanvas },
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Galleries' }} />
      <Stack.Screen
        name="[slug]"
        options={{
          headerBlurEffect: 'dark',
          headerShown: true,
          headerTintColor: palette.textPrimary,
          headerTransparent: true,
        }}
      />
    </Stack>
  )
}
