import { LinearGradient } from 'expo-linear-gradient'
import type { ColumnCountChangeEvent, ScrollBeyondThresholdEvent, VisibleRangeEvent } from 'photo-masonry'
import { isPhotoMasonryAvailable, PhotoMasonryView } from 'photo-masonry'
import { useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GalleryMasonry } from '@/modules/galleries/GalleryMasonry'
import { useGalleryManifest } from '@/modules/galleries/useGalleryManifest'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { formatVisibleDateRange } from './dateRange'
import { DateRangePill } from './DateRangePill'

let rememberedColumnCount = 2

export function OwnGalleryView({ slug }: { slug: string }) {
  if (!isPhotoMasonryAvailable) {
    return <GalleryMasonry slug={slug} />
  }
  return <NativeGallery slug={slug} />
}

function NativeGallery({ slug }: { slug: string }) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const insets = useSafeAreaInsets()
  const { error, loading, photos, refresh, refreshing, retry } = useGalleryManifest(slug)

  const [pillVisible, setPillVisible] = useState(false)
  const [visibleRange, setVisibleRange] = useState<{ start: number, end: number } | null>(null)

  const items = useMemo(
    () =>
      photos.map(photo => ({
        id: photo.id,
        url: photo.thumbnailUrl,
        thumbHash: photo.thumbHash,
        aspectRatio: photo.aspectRatio,
        isLive: photo.isLive,
      })),
    [photos],
  )

  const dateLabel = useMemo(
    () => (visibleRange ? formatVisibleDateRange(photos, visibleRange.start, visibleRange.end) : null),
    [photos, visibleRange],
  )

  const handleVisibleRangeChange = useCallback((event: { nativeEvent: VisibleRangeEvent }) => {
    setVisibleRange({ start: event.nativeEvent.startIndex, end: event.nativeEvent.endIndex })
  }, [])

  const handleScrollBeyondThreshold = useCallback((event: { nativeEvent: ScrollBeyondThresholdEvent }) => {
    setPillVisible(event.nativeEvent.beyond)
  }, [])

  const handleColumnCountChange = useCallback((event: { nativeEvent: ColumnCountChangeEvent }) => {
    rememberedColumnCount = event.nativeEvent.columnCount
  }, [])

  const handleRefresh = useCallback(() => void refresh(), [refresh])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.textSecondary} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>Failed to load photos</Text>
        <Text numberOfLines={2} style={styles.stateDetail}>
          {error.message}
        </Text>
        <Pressable
          accessibilityLabel="Retry loading photos"
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
          onPress={retry}
        >
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  if (photos.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.stateTitle}>No photos yet</Text>
        <Text style={styles.stateDetail}>Upload photos from the web dashboard and they will show up here.</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <PhotoMasonryView
        defaultColumnCount={rememberedColumnCount}
        extraBottomInset={24}
        extraTopInset={4}
        gap={4}
        photos={items}
        refreshing={refreshing}
        scrollThreshold={400}
        style={styles.masonry}
        onColumnCountChange={handleColumnCountChange}
        onRefresh={handleRefresh}
        onScrollBeyondThreshold={handleScrollBeyondThreshold}
        onVisibleRangeChange={handleVisibleRangeChange}
      />
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.55)', 'rgba(0, 0, 0, 0)']}
        pointerEvents="none"
        style={[styles.scrim, { height: insets.top + 24 }]}
      />
      <DateRangePill label={dateLabel} visible={pillVisible} />
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1 },
    masonry: { flex: 1 },
    scrim: {
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    center: {
      alignItems: 'center',
      flex: 1,
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    stateTitle: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 16,
      fontWeight: '600',
    },
    stateDetail: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 13,
      lineHeight: 19,
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
