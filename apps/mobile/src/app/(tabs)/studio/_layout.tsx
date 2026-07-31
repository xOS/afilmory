import { Stack } from 'expo-router'

import { useTranslation } from '@/i18n'
import { useTheme } from '@/theme/useTheme'

export default function StudioLayout() {
  const { t } = useTranslation()
  const { palette } = useTheme()

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.bgCanvas },
        headerBackButtonDisplayMode: 'minimal',
        headerShadowVisible: false,
        headerTintColor: palette.textPrimary,
        headerTransparent: true,
        scrollEdgeEffects: { top: 'soft' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerLargeTitle: true,
          title: t('tabs.studio'),
        }}
      />
      <Stack.Screen name="library" options={{ title: t('studio.library.title') }} />
      <Stack.Screen name="comments" options={{ title: t('studio.comments.title') }} />
      <Stack.Screen name="analytics" options={{ title: t('studio.analytics.title') }} />
      <Stack.Screen name="site" options={{ title: t('studio.site.title') }} />
      <Stack.Screen name="operations" options={{ title: t('studio.operations.title') }} />
    </Stack>
  )
}
