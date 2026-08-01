import { Stack } from 'expo-router'
import type { PhotoPressEvent, SelectionChangeEvent, SelectionModeChangeEvent } from 'photo-masonry'
import { PhotoMasonryView } from 'photo-masonry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { buildPhotoMasonryItem } from '@/modules/galleries/photoMasonryItem'
import { useOpenPhotoViewer } from '@/modules/photo-viewer/useOpenPhotoViewer'
import { usePhotoContextMenu } from '@/modules/photo-viewer/usePhotoContextMenu'
import { presentNativeUploadReview } from '@/native/photoSheets'
import { buildUploadQueueLocalization, NativeUploadFab, pickNativePhotos } from '@/native/photoUpload'
import { useTheme } from '@/theme/useTheme'

import { deletePhotoAssets, getPhotoAssetSummary, listPhotoAssets, updatePhotoAssetTags } from '../api'
import { parseTags, photoAssetToGalleryPhoto } from '../format'
import { StudioAccessBoundary, StudioErrorState, StudioLoadingState, StudioPlaceholder } from '../StudioNative'
import type { PhotoAssetListItem, PhotoAssetSummary } from '../types'
import { useRemoteResource } from '../useRemoteResource'
import { getRecentTags, rememberRecentTags } from './recentTags'
import { enqueueUploads, onQueueDrained, summarizeQueue, useUploadQueue } from './uploadQueue'
import { deriveDirectoryFromTags, orderTagSuggestions } from './uploadTags'

interface LibraryData {
  assets: PhotoAssetListItem[]
  summary: PhotoAssetSummary
}

export function StudioLibraryScreen() {
  return (
    <StudioAccessBoundary>
      <StudioLibraryContent />
    </StudioAccessBoundary>
  )
}

function StudioLibraryContent() {
  const { t } = useTranslation()
  const { palette } = useTheme()
  const auth = useAuth()
  const load = useCallback(async (): Promise<LibraryData> => {
    const [assets, summary] = await Promise.all([listPhotoAssets(), getPhotoAssetSummary()])
    return { assets, summary }
  }, [])
  const resource = useRemoteResource(load, [load])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [mutating, setMutating] = useState(false)
  const uploadJobs = useUploadQueue()
  const uploadSummary = useMemo(() => summarizeQueue(uploadJobs), [uploadJobs])
  const queueLocalization = useMemo(() => buildUploadQueueLocalization(), [])

  useEffect(() => onQueueDrained(() => void resource.reload()), [resource])

  const photos = useMemo(
    () => resource.data?.assets.map(photoAssetToGalleryPhoto).filter(photo => photo !== null) ?? [],
    [resource.data?.assets],
  )
  const masonryItems = useMemo(
    () =>
      photos.map(photo => buildPhotoMasonryItem(photo, t('photo.accessibility', { id: photo.title || photo.id }))),
    [photos, t],
  )
  const openPhoto = useOpenPhotoViewer(photos, auth.session?.activeWorkspace?.slug ?? null)
  const handlePhotoContextMenu = usePhotoContextMenu(photos)

  const leaveSelection = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds([])
  }, [])

  const handlePhotoPress = useCallback((event: { nativeEvent: PhotoPressEvent }) => openPhoto(event), [openPhoto])
  const handleSelectionChange = useCallback((event: { nativeEvent: SelectionChangeEvent }) => {
    setSelectedIds(event.nativeEvent.ids)
  }, [])
  const handleSelectionModeChange = useCallback((event: { nativeEvent: SelectionModeChangeEvent }) => {
    setSelectionMode(event.nativeEvent.active)
  }, [])

  const availableTags = useMemo(() => {
    const seen = new Set<string>()
    for (const asset of resource.data?.assets ?? []) {
      for (const tag of asset.manifest.data.tags ?? []) {
        seen.add(tag.toLowerCase())
      }
    }
    return [...seen]
  }, [resource.data?.assets])

  const handleUpload = useCallback(async () => {
    if (mutating) {
      return
    }
    try {
      let items = await pickNativePhotos()
      let tags: string[] = []
      while (items.length > 0) {
        const review = await presentNativeUploadReview(items, tags, orderTagSuggestions(availableTags, getRecentTags()))
        if (!review) {
          return
        }
        const kept = new Set(review.itemIds)
        items = items.filter(item => kept.has(item.id))
        tags = review.tags
        if (review.action === 'start') {
          rememberRecentTags(tags)
          await enqueueUploads(items, deriveDirectoryFromTags(tags))
          return
        }
        const seen = new Set(items.map(item => item.id))
        const more = await pickNativePhotos()
        items = [...items, ...more.filter(item => !seen.has(item.id))]
      }
    }
    catch (error) {
      Alert.alert(t('studio.upload.failed'), error instanceof Error ? error.message : t('studio.error.description'))
    }
  }, [availableTags, mutating, t])

  const handleEditTags = useCallback(() => {
    const selectedAssets = resource.data?.assets.filter(asset => selectedIds.includes(asset.id)) ?? []
    if (selectedAssets.length === 0 || mutating) {
      return
    }
    const initialTags = commonTags(selectedAssets).join(', ')
    Alert.prompt(
      t('studio.library.tags.title'),
      t('studio.library.tags.description'),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          text: t('common.save'),
          onPress: (value?: string) => {
            const tags = parseTags(value ?? '')
            setMutating(true)
            void Promise.all(selectedAssets.map(asset => updatePhotoAssetTags(asset.id, tags)))
              .then(() => resource.reload())
              .then(leaveSelection)
              .catch((error) => {
                Alert.alert(t('studio.library.tags.failed'), error instanceof Error ? error.message : undefined)
              })
              .finally(() => setMutating(false))
          },
        },
      ],
      'plain-text',
      initialTags,
    )
  }, [leaveSelection, mutating, resource, selectedIds, t])

  const performDelete = useCallback(
    async (deleteFromStorage: boolean) => {
      if (selectedIds.length === 0 || mutating) {
        return
      }
      setMutating(true)
      try {
        await deletePhotoAssets(selectedIds, deleteFromStorage)
        leaveSelection()
        await resource.reload()
      }
      catch (error) {
        Alert.alert(t('studio.library.delete.failed'), error instanceof Error ? error.message : undefined)
      }
      finally {
        setMutating(false)
      }
    },
    [leaveSelection, mutating, resource, selectedIds, t],
  )

  const confirmDelete = useCallback(() => {
    Alert.alert(
      t('studio.library.delete.title'),
      t('studio.library.delete.description', { count: selectedIds.length }),
      [
        { style: 'cancel', text: t('common.cancel') },
        {
          style: 'destructive',
          text: t('studio.library.delete.databaseOnly'),
          onPress: () => void performDelete(false),
        },
        {
          style: 'destructive',
          text: t('studio.library.delete.everywhere'),
          onPress: () => void performDelete(true),
        },
      ],
    )
  }, [performDelete, selectedIds.length, t])

  if (resource.loading && !resource.data) {
    return <StudioLoadingState />
  }
  if (resource.error && !resource.data) {
    return <StudioErrorState message={resource.error.message} onRetry={() => void resource.reload()} />
  }
  if (!resource.data) {
    return null
  }

  const busy = mutating
  const progressLabel = uploadSummary.running
    ? t('studio.upload.queue.headline', { done: uploadSummary.done, total: uploadSummary.total })
    : uploadSummary.failed > 0
      ? t('studio.upload.queue.failedCount', { count: uploadSummary.failed })
      : null
  const title = selectionMode
    ? t('studio.library.selected', { count: selectedIds.length })
    : (progressLabel ?? t('studio.library.title'))

  return (
    <View style={[styles.root, { backgroundColor: palette.bgCanvas }]}>
      <Stack.Title>{title}</Stack.Title>
      <Stack.Toolbar placement="right">
        {selectionMode ? (
          <Stack.Toolbar.Button
            accessibilityLabel={t('studio.library.tags.action')}
            disabled={selectedIds.length === 0 || mutating}
            icon="tag"
            onPress={handleEditTags}
          />
        ) : (
          <Stack.Toolbar.Button
            accessibilityLabel={t('studio.upload.action')}
            disabled={busy}
            icon="plus"
            onPress={() => void handleUpload()}
          />
        )}
        {selectionMode ? (
          <Stack.Toolbar.Button
            accessibilityLabel={t('common.delete')}
            disabled={selectedIds.length === 0 || mutating}
            icon="trash"
            tintColor={palette.danger}
            onPress={confirmDelete}
          />
        ) : (
          <Stack.Toolbar.Button disabled={busy || photos.length === 0} onPress={() => setSelectionMode(true)}>
            {t('common.select')}
          </Stack.Toolbar.Button>
        )}
        {selectionMode ? (
          <Stack.Toolbar.Button disabled={mutating} variant="done" onPress={leaveSelection}>
            {t('common.done')}
          </Stack.Toolbar.Button>
        ) : null}
      </Stack.Toolbar>

      {photos.length === 0 ? (
        <StudioPlaceholder
          action={{ label: t('studio.upload.action'), onPress: () => void handleUpload() }}
          description={t('studio.library.empty.description')}
          systemImage="photo.on.rectangle.angled"
          title={t('studio.library.empty.title')}
        />
      ) : (
        <PhotoMasonryView
          contextMenuInfoTitle={t('photo.info')}
          contextMenuSelectTitle={t('common.select')}
          contextMenuShareTitle={t('photo.share')}
          extraBottomInset={20}
          gap={3}
          livePhotoAccessibilityLabel={t('photo.livePhoto')}
          photos={masonryItems}
          refreshing={resource.refreshing}
          selectionEnabled
          selectedPhotoIds={selectedIds}
          selectionMode={selectionMode}
          style={styles.grid}
          onPhotoContextMenuAction={handlePhotoContextMenu}
          onPhotoPress={handlePhotoPress}
          onRefresh={() => void resource.reload()}
          onSelectionChange={handleSelectionChange}
          onSelectionModeChange={handleSelectionModeChange}
        />
      )}

      {selectionMode || uploadJobs.length === 0 ? null : (
        <NativeUploadFab localization={queueLocalization} style={styles.uploadFab} />
      )}
    </View>
  )
}

function commonTags(assets: PhotoAssetListItem[]): string[] {
  const [first, ...rest] = assets
  const initial = first?.manifest.data.tags ?? []
  return initial.filter(tag => rest.every(asset => asset.manifest.data.tags?.includes(tag)))
}

const styles = StyleSheet.create({
  grid: { flex: 1 },
  root: { flex: 1 },
  // Clear of the tab bar so it never competes with navigation targets.
  uploadFab: { bottom: 108, height: 52, position: 'absolute', right: 18, width: 52 },
})
