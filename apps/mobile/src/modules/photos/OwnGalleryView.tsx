import type { ColumnCountChangeEvent, PresentationAnchorEvent, VisibleRangeEvent } from 'photo-masonry'
import { PhotoMasonryView } from 'photo-masonry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { getGalleryOrigin } from '@/api/client'
import { getIntlLocale, useTranslation } from '@/i18n'
import { signOut, useAuth } from '@/modules/auth/sessionStore'
import { buildPhotoMasonryItem } from '@/modules/galleries/photoMasonryItem'
import { useGalleryManifest } from '@/modules/galleries/useGalleryManifest'
import { useOpenPhotoViewer } from '@/modules/photo-viewer/useOpenPhotoViewer'
import { usePhotoContextMenu } from '@/modules/photo-viewer/usePhotoContextMenu'
import { presentNativePhotoFilters, presentNativeProfile } from '@/native/photoSheets'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { getPreferredItemWidth, setPreferredItemWidth, waitForColumnPreference } from './columnPreference'
import { formatVisibleMonthAnchor } from './dateRange'
import { buildFilterOptions } from './filters/aggregates'
import { applyFilters } from './filters/applyFilters'
import { clearFilters, replaceFilters, useFilters } from './filters/filterStore'
import { countActiveDimensions, hasActiveFilters, summarizeFilters } from './filters/filterTypes'
import { cityForRange } from './filters/locationHint'
import { setHomeFeed } from './homeFeedStore'
import { collectProfileStats } from './profileStats'
import { PhotoSidebarAccessory } from './sidebar/PhotoSidebarAccessory'

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
    setHomeFeed(slug)
  }, [error, slug])

  const filtered = useMemo(() => applyFilters(photos, filters), [filters, photos])

  const items = useMemo(
    () =>
      filtered.map(photo => buildPhotoMasonryItem(photo, t('photo.accessibility', { id: photo.title || photo.id }))),
    [filtered, t],
  )

  const dateLabel = useMemo(() => {
    if (!visibleRange) {
      return null
    }
    return formatVisibleMonthAnchor(
      filtered,
      visibleRange.start,
      visibleRange.end,
      getIntlLocale(i18n.resolvedLanguage),
    )
  }, [filtered, i18n.resolvedLanguage, visibleRange])

  // Kept separate from the month anchor so the native pill can drop it whole when it does not fit.
  const dateDetail = useMemo(() => {
    if (!visibleRange || !dateLabel) {
      return ''
    }
    return cityForRange(filtered, visibleRange.start, visibleRange.end) ?? ''
  }, [dateLabel, filtered, visibleRange])

  const filtersActive = hasActiveFilters(filters)
  const openPhoto = useOpenPhotoViewer(filtered, slug)
  const handlePhotoContextMenu = usePhotoContextMenu(filtered)
  const filterCount = countActiveDimensions(filters)
  const filterOptions = useMemo(() => buildFilterOptions(photos), [photos])
  const openFilters = useCallback(
    (event: { nativeEvent: PresentationAnchorEvent }) => {
      void presentNativePhotoFilters(filters, filterOptions, event.nativeEvent.frame).then((next) => {
        if (next) {
          replaceFilters(next)
        }
      })
    },
    [filterOptions, filters],
  )
  const openProfile = useCallback(
    (event: { nativeEvent: PresentationAnchorEvent }) => {
      const session = auth.session
      if (!session?.activeWorkspace) {
        return
      }
      const stats = collectProfileStats(photos)
      const statsParts = [t('profile.stats.photos', { count: stats.photoCount })]
      if (stats.cameraCount > 0) {
        statsParts.push(t('profile.stats.cameras', { count: stats.cameraCount }))
      }
      if (stats.lensCount > 0) {
        statsParts.push(t('profile.stats.lenses', { count: stats.lensCount }))
      }
      if (stats.yearSpan) {
        statsParts.push(stats.yearSpan)
      }
      void presentNativeProfile(
        {
          userName: session.user.name,
          avatarUrl: session.user.image ?? '',
          avatarInitial: Array.from(session.user.name.trim())[0]?.toUpperCase() ?? '?',
          tenantLine: `${session.activeWorkspace.name} · ${session.activeWorkspace.slug}`,
          webUrl: getGalleryOrigin(session.activeWorkspace.slug),
          statsLine: photos.length === 0 ? '' : statsParts.join(' · '),
          strip: photos.slice(0, 12).map(photo => ({
            url: photo.thumbnailUrl,
            thumbHash: photo.thumbHash,
            aspectRatio: photo.aspectRatio,
          })),
        },
        event.nativeEvent.frame,
      ).then((action) => {
        if (action === 'signOut') {
          void signOut()
        }
      })
    },
    [auth.session, photos, t],
  )

  const handleVisibleRangeChange = useCallback((event: { nativeEvent: VisibleRangeEvent }) => {
    setVisibleRange({ start: event.nativeEvent.startIndex, end: event.nativeEvent.endIndex })
  }, [])

  const handleColumnCountChange = useCallback((event: { nativeEvent: ColumnCountChangeEvent }) => {
    setPreferredItemWidth(event.nativeEvent.preferredItemWidth)
  }, [])

  const handleRefresh = useCallback(() => void refresh(), [refresh])

  const hasFeed = columnsReady && !loading && error === null && photos.length > 0
  const chromeDateLabel = filtersActive ? `${filtered.length} · ${summarizeFilters(filters, t)}` : (dateLabel ?? '')
  const identityLabel = auth.session?.activeWorkspace?.name ?? ''
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
      <PhotoSidebarAccessory filterOptions={filterOptions} filters={filters} photos={photos} />
      {columnsReady ? (
        <PhotoMasonryView
          chromeVisible
          contextMenuInfoTitle={t('photo.info')}
          contextMenuShareTitle={t('photo.share')}
          chromeDateDetail={filtersActive ? '' : dateDetail}
          chromeDateInteractive={filtersActive}
          chromeDateLabel={chromeDateLabel}
          chromeDateVisible={hasFeed && (chromeDateLabel.length > 0 || identityLabel.length > 0)}
          chromeIdentityLabel={identityLabel}
          preferredItemWidth={getPreferredItemWidth()}
          extraBottomInset={24}
          extraTopInset={NATIVE_CHROME_HEIGHT}
          filterActive={filtersActive}
          filterAccessibilityLabel={filterAccessibilityLabel}
          filterCount={filterCount}
          gap={4}
          livePhotoAccessibilityLabel={t('photo.livePhoto')}
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
          onPhotoContextMenuAction={handlePhotoContextMenu}
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
