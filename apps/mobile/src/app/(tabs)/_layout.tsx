import { useSegments } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'

import { useTranslation } from '@/i18n'
import { useTheme } from '@/theme/useTheme'

export default function TabLayout() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const segments = useSegments() as string[]
  const isStudio = segments.includes('studio')

  return (
    <NativeTabs
      iconColor={{ default: palette.textSecondary, selected: palette.accent }}
      minimizeBehavior={isStudio ? 'never' : 'onScrollDown'}
      sidebarAdaptable
      tintColor={palette.accent}
    >
      <NativeTabs.Trigger name="photos">
        <NativeTabs.Trigger.Icon
          md="photo_library"
          sf={{ default: 'photo.on.rectangle', selected: 'photo.fill.on.rectangle.fill' }}
        />
        <NativeTabs.Trigger.Label>{t('tabs.photos')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon md="map" sf={{ default: 'map', selected: 'map.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Icon md="explore" sf="safari" />
        <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="studio">
        <NativeTabs.Trigger.Icon
          md="dashboard"
          sf={{ default: 'rectangle.3.group', selected: 'rectangle.3.group.fill' }}
        />
        <NativeTabs.Trigger.Label>{t('tabs.studio')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
