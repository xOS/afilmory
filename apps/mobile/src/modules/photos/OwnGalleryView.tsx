import { LinearGradient } from 'expo-linear-gradient'
import type { ColumnCountChangeEvent, ScrollBeyondThresholdEvent, VisibleRangeEvent } from 'photo-masonry'
import { isPhotoMasonryAvailable, PhotoMasonryView } from 'photo-masonry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GalleryMasonry } from '@/modules/galleries/GalleryMasonry'
import { useGalleryManifest } from '@/modules/galleries/useGalleryManifest'
import { present } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { formatVisibleDateRange } from './dateRange'
import { DateRangePill } from './DateRangePill'
import { applyFilters } from './filters/applyFilters'
import { clearFilters, useFilters } from './filters/filterStore'
import { hasActiveFilters, summarizeFilters } from './filters/filterTypes'
import { cityForRange } from './filters/locationHint'
import { filterSheetPage } from './filterSheetPage'
import { HOME_CHROME_HEIGHT, HomeButtons } from './HomeButtons'
import { setHomeFeed } from './homeFeedStore'

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

  const filters = useFilters()

  const [pillVisible, setPillVisible] = useState(false)
  const [visibleRange, setVisibleRange] = useState<{ start: number, end: number } | null>(null)

  useEffect(() => {
    if (error) {
      return
    }
    setHomeFeed(slug, photos)
  }, [error, photos, slug])

  const filtered = useMemo(() => applyFilters(photos, filters), [filters, photos])

  const items = useMemo(
    () =>
      filtered.map(photo => ({
        id: photo.id,
        url: photo.thumbnailUrl,
        thumbHash: photo.thumbHash,
        aspectRatio: photo.aspectRatio,
        isLive: photo.isLive,
      })),
    [filtered],
  )

  const dateLabel = useMemo(() => {
    if (!visibleRange) {
      return null
    }
    const range = formatVisibleDateRange(filtered, visibleRange.start, visibleRange.end)
    if (!range) {
      return null
    }
    const city = cityForRange(filtered, visibleRange.start, visibleRange.end)
    return city ? `${range} · ${city}` : range
  }, [filtered, visibleRange])

  const filtersActive = hasActiveFilters(filters)
  const openFilters = useCallback(() => void present(filterSheetPage), [])

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
      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.stateTitle}>No photos match the filters</Text>
          <Pressable
            accessibilityLabel="Clear filters"
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            onPress={clearFilters}
          >
            <Text style={styles.retryText}>Clear filters</Text>
          </Pressable>
        </View>
      ) : (
        <PhotoMasonryView
          defaultColumnCount={rememberedColumnCount}
          extraBottomInset={24}
          extraTopInset={HOME_CHROME_HEIGHT}
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
      )}
      <LinearGradient
        colors={['rgba(0, 0, 0, 0.5)', 'rgba(0, 0, 0, 0)']}
        pointerEvents="none"
        style={[styles.scrim, { height: insets.top + 8 }]}
      />
      <DateRangePill
        label={filtersActive ? `${filtered.length} · ${summarizeFilters(filters)}` : dateLabel}
        visible={filtersActive || pillVisible}
        onPress={filtersActive ? openFilters : undefined}
      />
      <HomeButtons />
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
