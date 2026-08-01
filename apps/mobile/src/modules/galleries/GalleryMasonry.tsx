import { PhotoMasonryView } from 'photo-masonry'
import { useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { useOpenPhotoViewer } from '@/modules/photo-viewer/useOpenPhotoViewer'
import { usePhotoContextMenu } from '@/modules/photo-viewer/usePhotoContextMenu'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { buildPhotoMasonryItem } from './photoMasonryItem'
import { useGalleryManifest } from './useGalleryManifest'

export function GalleryMasonry({ slug }: { slug: string }) {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const { error, loading, photos, retry } = useGalleryManifest(slug)
  const openPhoto = useOpenPhotoViewer(photos, slug)
  const handlePhotoContextMenu = usePhotoContextMenu(photos)
  const items = useMemo(
    () =>
      photos.map(photo => buildPhotoMasonryItem(photo, t('photo.accessibility', { id: photo.title || photo.id }))),
    [photos, t],
  )

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
        <Text style={styles.errorTitle}>{t('gallery.failed.photos')}</Text>
        <Text numberOfLines={2} style={styles.errorDetail}>
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

  return (
    <PhotoMasonryView
      chromeVisible={false}
      contextMenuInfoTitle={t('photo.info')}
      contextMenuShareTitle={t('photo.share')}
      defaultColumnCount={2}
      extraBottomInset={96}
      gap={4}
      livePhotoAccessibilityLabel={t('photo.livePhoto')}
      photos={items}
      style={styles.masonry}
      onPhotoContextMenuAction={handlePhotoContextMenu}
      onPhotoPress={openPhoto}
    />
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    center: {
      alignItems: 'center',
      flex: 1,
      gap: 8,
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    masonry: { flex: 1 },
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
