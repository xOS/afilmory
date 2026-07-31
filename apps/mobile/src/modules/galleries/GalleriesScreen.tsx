import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { getExploreGridMetrics } from '@/modules/shell/adaptiveLayout'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { GalleryCard } from './GalleryCard'
import type { FeaturedGallery } from './types'
import { useFeaturedGalleries } from './useFeaturedGalleries'

export function GalleriesScreen() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const { error, galleries, loading, refresh, refreshing, retry } = useFeaturedGalleries()
  const router = useRouter()
  const [contentWidth, setContentWidth] = useState(0)
  const gridMetrics = useMemo(() => getExploreGridMetrics(contentWidth), [contentWidth])
  const gridStyles = useMemo(
    () =>
      StyleSheet.create({
        cardWrapper: {
          paddingBottom: gridMetrics.gap,
          paddingHorizontal: gridMetrics.gap / 2,
        },
        listContent: {
          paddingBottom: 120,
          paddingHorizontal: Math.max(0, gridMetrics.horizontalPadding - gridMetrics.gap / 2),
          paddingTop: 12,
        },
      }),
    [gridMetrics],
  )
  const openGallery = useCallback(
    (gallery: FeaturedGallery) => {
      router.push({
        pathname: '/explore/[slug]',
        params: { slug: gallery.slug, gallery: JSON.stringify(gallery) },
      })
    },
    [router],
  )
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width
    setContentWidth(current => (current === nextWidth ? current : nextWidth))
  }, [])
  const renderGallery = useCallback(
    ({ item }: { item: FeaturedGallery }) => (
      <View style={gridStyles.cardWrapper}>
        <GalleryCard gallery={item} onPress={openGallery} />
      </View>
    ),
    [gridStyles.cardWrapper, openGallery],
  )

  return (
    <View style={styles.root} onLayout={handleLayout}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.textSecondary} />
        </View>
      ) : error && galleries.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t('gallery.failed.galleries')}</Text>
          <Text numberOfLines={2} style={styles.errorDetail}>
            {t('gallery.failed.detail')}
          </Text>
          <Pressable
            accessibilityLabel={t('accessibility.retryGalleries')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            onPress={retry}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          key={`gallery-grid-${gridMetrics.columns}`}
          contentContainerStyle={gridStyles.listContent}
          contentInsetAdjustmentBehavior="automatic"
          data={galleries}
          numColumns={gridMetrics.columns}
          keyExtractor={(item: FeaturedGallery) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} tintColor={palette.textSecondary} onRefresh={refresh} />
          }
          renderItem={renderGallery}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bgCanvas },
    center: {
      alignItems: 'center',
      flex: 1,
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    errorTitle: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 16,
      fontWeight: '600',
    },
    errorDetail: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 13,
      textAlign: 'center',
    },
    retryButton: {
      backgroundColor: palette.accentDim,
      borderCurve: 'continuous',
      borderRadius: 10,
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    retryText: {
      color: palette.accent,
      fontFamily: font.ui,
      fontSize: 14,
      fontWeight: '600',
    },
    pressed: { opacity: 0.6 },
  })
}
