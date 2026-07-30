import type { ColumnCountChangeEvent, VisibleRangeEvent } from 'photo-masonry'
import { PhotoMasonryView } from 'photo-masonry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { getIntlLocale, useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { useGalleryManifest } from '@/modules/galleries/useGalleryManifest'
import { useOpenPhotoViewer } from '@/modules/photo-viewer/useOpenPhotoViewer'
import { presentNativePhotoFilters } from '@/native/photoSheets'
import { present } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { getPreferredColumnCount, setPreferredColumnCount, waitForColumnPreference } from './columnPreference'
import { formatVisibleDateRange } from './dateRange'
import { buildFilterOptions } from './filters/aggregates'
import { applyFilters } from './filters/applyFilters'
import { clearFilters, replaceFilters, useFilters } from './filters/filterStore'
import { countActiveDimensions, hasActiveFilters, summarizeFilters } from './filters/filterTypes'
import { cityForRange } from './filters/locationHint'
import { setHomeFeed } from './homeFeedStore'
import { profileSheetPage } from './profileSheetPage'

const NATIVE_CHROME_HEIGHT = 60

export function OwnGalleryView({ slug }: { slug: string }) {
  return <NativeGallery slug={slug} />
}

function NativeGallery({ slug }: { slug: string }) {
  const { palette } = useTheme()
  const { i18n, t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const { error, loading, photos, refresh, refreshing, retry } = useGalleryManifest(slug)
  const auth = useAuth()

  const filters = useFilters()

  const [visibleRange, setVisibleRange] = useState<{ start: number, end: number } | null>(null)
  const [columnsReady, setColumnsReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void waitForColumnPreference().then(() => {
      if (!cancelled) {
        setColumnsReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

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
        accessibilityLabel: t('photo.accessibility', { id: photo.title || photo.id }),
        id: photo.id,
        url: photo.thumbnailUrl,
        originalUrl: photo.originalUrl,
        thumbHash: photo.thumbHash,
        aspectRatio: photo.aspectRatio,
        width: photo.width,
        height: photo.height,
        isLive: photo.isLive,
      })),
    [filtered, t],
  )

  const dateLabel = useMemo(() => {
    if (!visibleRange) {
      return null
    }
    return formatVisibleDateRange(filtered, visibleRange.start, visibleRange.end, getIntlLocale(i18n.resolvedLanguage))
  }, [filtered, i18n.resolvedLanguage, visibleRange])

  // Kept separate from the range so the native pill can drop it whole when it does not fit.
  const dateDetail = useMemo(() => {
    if (!visibleRange || !dateLabel) {
      return ''
    }
    return cityForRange(filtered, visibleRange.start, visibleRange.end) ?? ''
  }, [dateLabel, filtered, visibleRange])

  const filtersActive = hasActiveFilters(filters)
  const openPhoto = useOpenPhotoViewer(filtered)
  const filterCount = countActiveDimensions(filters)
  const filterOptions = useMemo(() => buildFilterOptions(photos), [photos])
  const openFilters = useCallback(() => {
    void presentNativePhotoFilters(filters, filterOptions).then((next) => {
      if (next) {
        replaceFilters(next)
      }
    })
  }, [filterOptions, filters])
  const openProfile = useCallback(() => void present(profileSheetPage), [])

  const handleVisibleRangeChange = useCallback((event: { nativeEvent: VisibleRangeEvent }) => {
    setVisibleRange({ start: event.nativeEvent.startIndex, end: event.nativeEvent.endIndex })
  }, [])

  const handleColumnCountChange = useCallback((event: { nativeEvent: ColumnCountChangeEvent }) => {
    setPreferredColumnCount(event.nativeEvent.columnCount)
  }, [])

  const handleRefresh = useCallback(() => void refresh(), [refresh])

  const hasFeed = columnsReady && !loading && error === null && photos.length > 0
  const chromeDateLabel = filtersActive ? `${filtered.length} · ${summarizeFilters(filters, t)}` : (dateLabel ?? '')
  const profileInitial = Array.from((auth.session?.user.name ?? '?').trim())[0]?.toUpperCase() ?? '?'
  const profileAccessibilityLabel = auth.session?.user.name
    ? t('accessibility.profile', { name: auth.session.user.name })
    : t('accessibility.profileUnknown')
  const filterAccessibilityLabel = filtersActive
    ? t('accessibility.filtersActive', { count: filterCount })
    : t('accessibility.filters')

  function renderState() {
    if (loading || !columnsReady) {
      return (
        <View pointerEvents="box-none" style={styles.center}>
          <ActivityIndicator color={palette.textSecondary} />
        </View>
      )
    }

    if (error) {
      return (
        <View pointerEvents="box-none" style={styles.center}>
          <Text style={styles.stateTitle}>{t('gallery.failed.photos')}</Text>
          <Text numberOfLines={2} style={styles.stateDetail}>
            {t('gallery.failed.detail')}
          </Text>
          <Pressable
            accessibilityLabel={t('accessibility.retryPhotos')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            onPress={retry}
          >
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      )
    }

    if (photos.length === 0) {
      return (
        <View pointerEvents="box-none" style={styles.center}>
          <Text style={styles.stateTitle}>{t('gallery.empty.title')}</Text>
          <Text style={styles.stateDetail}>{t('gallery.empty.subtitle')}</Text>
        </View>
      )
    }

    if (filtered.length === 0) {
      return (
        <View pointerEvents="box-none" style={styles.center}>
          <Text style={styles.stateTitle}>{t('gallery.empty.filtered')}</Text>
          <Pressable
            accessibilityLabel={t('accessibility.clearFilters')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            onPress={clearFilters}
          >
            <Text style={styles.retryText}>{t('common.clearFilters')}</Text>
          </Pressable>
        </View>
      )
    }

    return null
  }

  return (
    <View style={styles.root}>
      {columnsReady ? (
        <PhotoMasonryView
          chromeVisible
          chromeDateDetail={filtersActive ? '' : dateDetail}
          chromeDateInteractive={filtersActive}
          chromeDateLabel={chromeDateLabel}
          chromeDateVisible={hasFeed && chromeDateLabel.length > 0}
          defaultColumnCount={getPreferredColumnCount()}
          extraBottomInset={24}
          extraTopInset={NATIVE_CHROME_HEIGHT}
          filterActive={filtersActive}
          filterAccessibilityLabel={filterAccessibilityLabel}
          filterCount={filterCount}
          gap={4}
          photos={error ? [] : items}
          profileImageURL={auth.session?.user.image ?? ''}
          profileAccessibilityLabel={profileAccessibilityLabel}
          profileInitial={profileInitial}
          refreshing={refreshing}
          scrollThreshold={400}
          style={styles.masonry}
          onColumnCountChange={handleColumnCountChange}
          onDatePress={openFilters}
          onFilterPress={openFilters}
          onPhotoPress={openPhoto}
          onProfilePress={openProfile}
          onRefresh={handleRefresh}
          onVisibleRangeChange={handleVisibleRangeChange}
        />
      ) : null}
      {renderState()}
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1 },
    masonry: { flex: 1 },
    center: {
      alignItems: 'center',
      bottom: 0,
      gap: 8,
      justifyContent: 'center',
      left: 0,
      paddingHorizontal: 32,
      position: 'absolute',
      right: 0,
      top: 0,
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
