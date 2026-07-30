import { Stack } from 'expo-router'

import { useTranslation } from '@/i18n'
import { useTheme } from '@/theme/useTheme'

export default function ExploreLayout() {
  const { palette } = useTheme()
  const { t } = useTranslation()

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: palette.bgCanvas },
        headerTintColor: palette.textPrimary,
        headerTransparent: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: t('tabs.explore') }} />
      <Stack.Screen name="[slug]" />
    </Stack>
  )
}
