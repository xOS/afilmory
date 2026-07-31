import { Button, ContentUnavailableView, Form, Section } from '@expo/ui/swift-ui'
import { buttonStyle } from '@expo/ui/swift-ui/modifiers'
import { Stack } from 'expo-router'
import type { PhotoPressEvent, SelectionChangeEvent, SelectionModeChangeEvent } from 'photo-masonry'
import { PhotoMasonryView } from 'photo-masonry'
import { useCallback, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { livePhotoVideoUrl } from '@/modules/galleries/videoSource'
import { useOpenPhotoViewer } from '@/modules/photo-viewer/useOpenPhotoViewer'
import { usePhotoContextMenu } from '@/modules/photo-viewer/usePhotoContextMenu'
import { useTheme } from '@/theme/useTheme'

import { deletePhotoAssets, getPhotoAssetSummary, listPhotoAssets, updatePhotoAssetTags } from '../api'
import { parseTags, photoAssetToGalleryPhoto } from '../format'
import { StudioAccessBoundary, StudioErrorState, StudioHost, StudioLoadingState } from '../StudioNative'
import type { PhotoAssetListItem, PhotoAssetSummary } from '../types'
import { useRemoteResource } from '../useRemoteResource'
import type { UploadProgress } from './upload'
import { pickPhotosForUpload, uploadPhotos } from './upload'

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
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [mutating, setMutating] = useState(false)

  const photos = useMemo(
    () => resource.data?.assets.map(photoAssetToGalleryPhoto).filter(photo => photo !== null) ?? [],
    [resource.data?.assets],
  )
  const masonryItems = useMemo(
    () =>
      photos.map(photo => ({
        accessibilityLabel: t('photo.accessibility', { id: photo.title || photo.id }),
        aspectRatio: photo.aspectRatio,
        height: photo.height,
        id: photo.id,
        livePhotoVideoUrl: livePhotoVideoUrl(photo.video),
        originalUrl: photo.originalUrl,
        thumbHash: photo.thumbHash,
        url: photo.thumbnailUrl,
        width: photo.width,
      })),
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

  const handleUpload = useCallback(async () => {
    if (uploadProgress || mutating) {
      return
    }
    try {
      const picked = await pickPhotosForUpload()
      if (picked.length === 0) {
        return
      }
      await uploadPhotos(picked, setUploadProgress)
      await resource.reload()
    }
    catch (error) {
      Alert.alert(t('studio.upload.failed'), error instanceof Error ? error.message : t('studio.error.description'))
    }
    finally {
      setUploadProgress(null)
    }
  }, [mutating, resource, t, uploadProgress])

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

  const busy = uploadProgress !== null || mutating
  const progressLabel = uploadProgress
    ? t(uploadProgress.phase === 'uploading' ? 'studio.upload.uploading' : 'studio.upload.processing', {
        progress: Math.round(uploadProgress.progress * 100),
      })
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
        <StudioHost>
          <Form>
            <Section>
              <ContentUnavailableView
                description={t('studio.library.empty.description')}
                systemImage="photo.on.rectangle.angled"
                title={t('studio.library.empty.title')}
              />
              <Button
                label={t('studio.upload.action')}
                modifiers={[buttonStyle('borderedProminent')]}
                onPress={() => void handleUpload()}
              />
            </Section>
          </Form>
        </StudioHost>
      ) : (
        <PhotoMasonryView
          contextMenuInfoTitle={t('photo.info')}
          contextMenuSelectTitle={t('common.select')}
          contextMenuShareTitle={t('photo.share')}
          extraBottomInset={20}
          gap={3}
          livePhotoBadgeTitle={t('photo.livePhoto')}
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
})
