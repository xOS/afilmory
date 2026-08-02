import { useSegments } from 'expo-router'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { useEffect, useMemo, useState } from 'react'
import { Platform } from 'react-native'

import { useTranslation } from '@/i18n'
import { nativePhotoSidebar } from '@/native/photoSidebar'
import { useTheme } from '@/theme/useTheme'

export default function TabLayout() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const segments = useSegments() as string[]
  const isStudio = segments.includes('studio')
  const [contentTrailingInset, setContentTrailingInset] = useState(0)
  const contentStyle = useMemo(
    () => (contentTrailingInset > 0 ? { paddingRight: contentTrailingInset } : undefined),
    [contentTrailingInset],
  )

  useEffect(() => {
    if (Platform.OS === 'ios' && Platform.isPad) {
      const subscription = nativePhotoSidebar.addListener('onContentLayoutChange', (event) => {
        const nextInset = Math.max(0, event.trailingInset)
        setContentTrailingInset(current => (Math.abs(current - nextInset) < 0.5 ? current : nextInset))
      })
      void nativePhotoSidebar.setTiledLayout()
      return () => subscription.remove()
    }
  }, [])

  return (
    <NativeTabs
      iconColor={{ default: palette.textSecondary, selected: palette.accent }}
      minimizeBehavior={isStudio ? 'never' : 'onScrollDown'}
      sidebarAdaptable
      tintColor={palette.accent}
    >
      <NativeTabs.Trigger contentStyle={contentStyle} name="photos">
        <NativeTabs.Trigger.Icon
          md="photo_library"
          sf={{ default: 'photo.on.rectangle', selected: 'photo.fill.on.rectangle.fill' }}
        />
        <NativeTabs.Trigger.Label>{t('tabs.photos')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger contentStyle={contentStyle} name="map">
        <NativeTabs.Trigger.Icon md="map" sf={{ default: 'map', selected: 'map.fill' }} />
        <NativeTabs.Trigger.Label>{t('tabs.map')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger contentStyle={contentStyle} name="explore">
        <NativeTabs.Trigger.Icon md="explore" sf="safari" />
        <NativeTabs.Trigger.Label>{t('tabs.explore')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger contentStyle={contentStyle} name="studio">
        <NativeTabs.Trigger.Icon
          md="dashboard"
          sf={{ default: 'rectangle.3.group', selected: 'rectangle.3.group.fill' }}
        />
        <NativeTabs.Trigger.Label>{t('tabs.studio')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
