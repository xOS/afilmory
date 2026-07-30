import { StatusBar } from 'expo-status-bar'
import { SymbolView } from 'expo-symbols'
import type { PhotoViewerIndexChangeEvent } from 'photo-masonry'
import { PhotoViewerView } from 'photo-masonry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { present, usePageRuntime } from '@/presentation'
import { font } from '@/theme/tokens'

import type { PhotoDetailRouteParams } from './photoDetailPage'
import { photoInfoPage } from './photoInfoPage'
import { getPhotoViewerSession, releasePhotoViewerSession } from './sessionStore'

export function PhotoDetailScreen() {
  const { cancel, params } = usePageRuntime<PhotoDetailRouteParams>()
  const session = getPhotoViewerSession(params.sessionId)
  const [currentIndex, setCurrentIndex] = useState(session?.initialIndex ?? 0)

  useEffect(() => () => releasePhotoViewerSession(params.sessionId), [params.sessionId])

  const items = useMemo(
    () =>
      session?.photos.map(photo => ({
        id: photo.id,
        url: photo.thumbnailUrl,
        originalUrl: photo.originalUrl,
        thumbHash: photo.thumbHash,
        aspectRatio: photo.aspectRatio,
        width: photo.width,
        height: photo.height,
        isLive: photo.isLive,
      })) ?? [],
    [session],
  )

  const currentPhoto = session?.photos[currentIndex] ?? null
  const handleIndexChange = useCallback((event: { nativeEvent: PhotoViewerIndexChangeEvent }) => {
    setCurrentIndex(event.nativeEvent.index)
  }, [])
  const openInfo = useCallback(() => {
    if (currentPhoto) {
      void present(photoInfoPage, currentPhoto)
    }
  }, [currentPhoto])
  const sharePhoto = useCallback(() => {
    if (!currentPhoto) {
      return
    }
    void Share.share({
      message: currentPhoto.title || currentPhoto.originalUrl,
      url: currentPhoto.originalUrl,
    })
  }, [currentPhoto])

  if (!session || !currentPhoto) {
    return (
      <View style={[styles.root, styles.missing]}>
        <StatusBar style="light" />
        <Text style={styles.missingTitle}>Photo unavailable</Text>
        <Pressable accessibilityRole="button" onPress={cancel}>
          <Text style={styles.missingAction}>Go back</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <PhotoViewerView
        initialIndex={session.initialIndex}
        photos={items}
        style={styles.viewer}
        testID="photo-viewer"
        transitionId={session.transitionId}
        onIndexChange={handleIndexChange}
      />

      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topChrome}>
        <View style={styles.toolbar}>
          <ChromeButton accessibilityLabel="Close photo" symbol="xmark" onPress={cancel} />
          <View style={styles.toolbarActions}>
            <ChromeButton accessibilityLabel="Photo information" symbol="info.circle" onPress={openInfo} />
            <ChromeButton accessibilityLabel="Share photo" symbol="square.and.arrow.up" onPress={sharePhoto} />
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} pointerEvents="none" style={styles.bottomChrome}>
        <Text numberOfLines={1} style={styles.caption}>
          {currentPhoto.title || currentPhoto.dateTaken || ''}
        </Text>
        <Text style={styles.counter}>
          {currentIndex + 1}
          {' '}
          /
          {session.photos.length}
        </Text>
      </SafeAreaView>
    </View>
  )
}

function ChromeButton({
  accessibilityLabel,
  onPress,
  symbol,
}: {
  accessibilityLabel: string
  onPress: () => void
  symbol: 'info.circle' | 'square.and.arrow.up' | 'xmark'
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [styles.chromeButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      <SymbolView name={symbol} size={17} tintColor="#fff" />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#000', flex: 1 },
  viewer: { flex: 1 },
  topChrome: { left: 0, position: 'absolute', right: 0, top: 0, zIndex: 1 },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  toolbarActions: { flexDirection: 'row', gap: 10 },
  chromeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,20,22,0.72)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bottomChrome: {
    alignItems: 'center',
    bottom: 0,
    gap: 4,
    left: 0,
    paddingBottom: 8,
    paddingHorizontal: 64,
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  caption: {
    color: '#fff',
    fontFamily: font.ui,
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  counter: {
    color: 'rgba(255,255,255,0.62)',
    fontFamily: font.mono,
    fontSize: 11,
  },
  pressed: { opacity: 0.5, transform: [{ scale: 0.94 }] },
  missing: { alignItems: 'center', gap: 14, justifyContent: 'center' },
  missingTitle: { color: '#fff', fontFamily: font.ui, fontSize: 18, fontWeight: '600' },
  missingAction: { color: '#0a84ff', fontFamily: font.ui, fontSize: 16, fontWeight: '600' },
})
