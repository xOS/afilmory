import type { PhotoMapItem, PhotoMapPressEvent } from 'photo-masonry'
import { PhotoMapView } from 'photo-masonry'
import { useCallback, useMemo } from 'react'
import { StyleSheet } from 'react-native'

import { getIntlLocale, useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { signInPage } from '@/modules/auth/signInPage'
import type { GalleryPhoto } from '@/modules/galleries/types'
import { useGalleryManifest } from '@/modules/galleries/useGalleryManifest'
import { useOpenPhotoViewer } from '@/modules/photo-viewer/useOpenPhotoViewer'
import { applyFilters } from '@/modules/photos/filters/applyFilters'
import { clearFilters, useFilters } from '@/modules/photos/filters/filterStore'
import { hasActiveFilters } from '@/modules/photos/filters/filterTypes'
import { present } from '@/presentation'

import { buildPhotoMapItems } from './photoMapModel'

type NativeMapState = 'empty' | 'error' | 'filteredEmpty' | 'loading' | 'pending' | 'ready' | 'signedOut'

export function PhotoMapScreen() {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <NativeMapPage photos={[]} state="loading" />
  }
  if (auth.status === 'signedOut') {
    return <NativeMapPage photos={[]} state="signedOut" onSignIn={() => void present(signInPage)} />
  }

  const workspace = auth.session?.activeWorkspace
  if (!workspace || workspace.status !== 'active') {
    return <NativeMapPage photos={[]} state="pending" />
  }

  return <GalleryPhotoMap slug={workspace.slug} />
}

function GalleryPhotoMap({ slug }: { slug: string }) {
  const { i18n, t } = useTranslation()
  const { error, loading, photos, retry } = useGalleryManifest(slug)
  const filters = useFilters()
  const filtered = useMemo(() => applyFilters(photos, filters), [filters, photos])
  const openPhoto = useOpenPhotoViewer(filtered, slug)
  const locale = getIntlLocale(i18n.resolvedLanguage)
  const mapPhotos = useMemo<PhotoMapItem[]>(
    () =>
      buildPhotoMapItems(filtered, photo => t('map.marker.accessibility', { title: photo.title || photo.id })).map(
        item => ({
          ...item,
          openAccessibilityLabel: t('map.openPhoto', { title: item.title }),
          subtitle: photoSubtitle(filtered[item.index], locale),
        }),
      ),
    [filtered, locale, t],
  )
  const state: NativeMapState = loading
    ? 'loading'
    : error
      ? 'error'
      : mapPhotos.length === 0
        ? hasActiveFilters(filters)
          ? 'filteredEmpty'
          : 'empty'
        : 'ready'

  const handlePhotoPress = useCallback(
    (event: { nativeEvent: PhotoMapPressEvent }) => {
      const pressed = event.nativeEvent
      openPhoto({
        nativeEvent: {
          frame: { x: 0, y: 0, width: 0, height: 0 },
          id: pressed.id,
          index: pressed.index,
          transitionId: '',
        },
      })
    },
    [openPhoto],
  )

  return (
    <NativeMapPage
      photos={mapPhotos}
      state={state}
      onClearFilters={clearFilters}
      onPhotoPress={handlePhotoPress}
      onRetry={retry}
    />
  )
}

interface NativeMapPageProps {
  photos: PhotoMapItem[]
  state: NativeMapState
  onClearFilters?: () => void
  onPhotoPress?: (event: { nativeEvent: PhotoMapPressEvent }) => void
  onRetry?: () => void
  onSignIn?: () => void
}

function NativeMapPage({ photos, state, onClearFilters, onPhotoPress, onRetry, onSignIn }: NativeMapPageProps) {
  const { t } = useTranslation()
  const stringsJSON = useMemo(
    () =>
      JSON.stringify({
        clearFilters: t('common.clearFilters'),
        clearSelection: t('map.clearSelection'),
        clusterAccessibilityLabel: t('map.cluster.accessibility'),
        emptyDescription: t('map.empty.description'),
        emptyTitle: t('map.empty.title'),
        errorDescription: t('map.failed.description'),
        errorTitle: t('map.failed.title'),
        fitAll: t('map.fit'),
        filteredEmptyDescription: t('map.filteredEmpty.description'),
        filteredEmptyTitle: t('gallery.empty.filtered'),
        loading: t('map.loading'),
        locations: t('map.locations', { count: photos.length }),
        pendingDescription: t('gallery.workspace.pending.subtitle'),
        pendingTitle: t('gallery.workspace.pending.title'),
        previewDefaultDetail: t('map.preview.defaultDetail'),
        retry: t('common.retry'),
        signIn: t('common.signIn'),
        signedOutDescription: t('map.signedOut.description'),
        signedOutTitle: t('map.signedOut.title'),
        title: t('map.title'),
      }),
    [photos.length, t],
  )

  return (
    <PhotoMapView
      photos={photos}
      state={state}
      stringsJSON={stringsJSON}
      style={styles.root}
      testID="photo-map"
      onClearFilters={onClearFilters}
      onPhotoPress={onPhotoPress}
      onRetry={onRetry}
      onSignIn={onSignIn}
    />
  )
}

function photoSubtitle(photo: GalleryPhoto | undefined, locale: string): string {
  if (!photo) {
    return ''
  }

  const parts = [photo.city, photo.camera]
  if (photo.dateTaken) {
    const date = new Date(photo.dateTaken)
    if (!Number.isNaN(date.getTime())) {
      parts.push(new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date))
    }
  }
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

const styles = StyleSheet.create({ root: { flex: 1 } })
