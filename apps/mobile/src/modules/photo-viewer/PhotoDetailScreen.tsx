import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import { StatusBar } from 'expo-status-bar'
import { SymbolView } from 'expo-symbols'
import type { PhotoViewerIndexChangeEvent } from 'photo-masonry'
import { PhotoViewerView } from 'photo-masonry'
import type { PropsWithChildren } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getIntlLocale, useTranslation } from '@/i18n'
import { presentNativePhotoInfo } from '@/native/photoSheets'
import { usePageRuntime } from '@/presentation'
import { font } from '@/theme/tokens'

import type { PhotoDetailRouteParams } from './photoDetailPage'
import { buildPhotoInfoModel } from './photoInfoModel'
import { getPhotoViewerSession, releasePhotoViewerSession } from './sessionStore'

type GlassButtonSymbol = 'info.circle' | 'square.and.arrow.up' | 'xmark'

const GLASS_BUTTON_ICON_SIZES: Record<GlassButtonSymbol, number> = {
  'info.circle': 26,
  'square.and.arrow.up': 30,
  'xmark': 23,
}

export function PhotoDetailScreen() {
  const { cancel, params } = usePageRuntime<PhotoDetailRouteParams>()
  const { i18n, t } = useTranslation()
  const session = getPhotoViewerSession(params.sessionId)
  const [currentIndex, setCurrentIndex] = useState(session?.initialIndex ?? 0)
  const nativeGlassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable()

  useEffect(() => () => releasePhotoViewerSession(params.sessionId), [params.sessionId])

  const items = useMemo(
    () =>
      session?.photos.map(photo => ({
        accessibilityLabel: t('photo.accessibility', { id: photo.title || photo.id }),
        id: photo.id,
        url: photo.thumbnailUrl,
        originalUrl: photo.originalUrl,
        thumbHash: photo.thumbHash,
        aspectRatio: photo.aspectRatio,
        width: photo.width,
        height: photo.height,
        isLive: photo.isLive,
      })) ?? [],
    [session, t],
  )

  const currentPhoto = session?.photos[currentIndex] ?? null
  const handleIndexChange = useCallback((event: { nativeEvent: PhotoViewerIndexChangeEvent }) => {
    setCurrentIndex(event.nativeEvent.index)
  }, [])
  const openInfo = useCallback(() => {
    if (currentPhoto) {
      const model = buildPhotoInfoModel(currentPhoto, t, getIntlLocale(i18n.resolvedLanguage))
      void presentNativePhotoInfo({
        title: currentPhoto.title,
        description: currentPhoto.description || null,
        sections: [model.basic, ...model.sections],
        captureParameters: model.captureParameters,
        tags: currentPhoto.tags,
        toneAnalysis: model.toneAnalysis,
        mapLocation: model.mapLocation,
        emptyMessage: model.hasExif ? null : t('photo.noExif'),
      })
    }
  }, [currentPhoto, i18n.resolvedLanguage, t])
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
        <Text style={styles.missingTitle}>{t('photo.unavailable')}</Text>
        <Pressable accessibilityRole="button" onPress={cancel}>
          <Text style={styles.missingAction}>{t('common.goBack')}</Text>
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
        <View pointerEvents="box-none" style={styles.toolbar}>
          <ChromeButton
            accessibilityLabel={t('photo.close')}
            nativeGlassAvailable={nativeGlassAvailable}
            symbol="xmark"
            onPress={cancel}
          />
          <ChromeButtonCluster nativeGlassAvailable={nativeGlassAvailable}>
            <ChromeButton
              accessibilityLabel={t('photo.info')}
              nativeGlassAvailable={nativeGlassAvailable}
              symbol="info.circle"
              onPress={openInfo}
            />
            <ChromeButton
              accessibilityLabel={t('photo.share')}
              nativeGlassAvailable={nativeGlassAvailable}
              symbol="square.and.arrow.up"
              onPress={sharePhoto}
            />
          </ChromeButtonCluster>
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
  nativeGlassAvailable,
  onPress,
  symbol,
}: {
  accessibilityLabel: string
  nativeGlassAvailable: boolean
  onPress: () => void
  symbol: GlassButtonSymbol
}) {
  const content = (
    <SymbolView name={symbol} scale="large" size={GLASS_BUTTON_ICON_SIZES[symbol]} tintColor="#fff" weight="regular" />
  )

  if (nativeGlassAvailable) {
    return (
      <GlassView colorScheme="dark" glassEffectStyle="regular" isInteractive style={styles.chromeButtonSurface}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.chromeButtonContent, pressed && styles.glassContentPressed]}
          onPress={onPress}
        >
          {content}
        </Pressable>
      </GlassView>
    )
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => [
        styles.chromeButtonSurface,
        styles.chromeButtonContent,
        styles.chromeButtonFallback,
        pressed && styles.fallbackPressed,
      ]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  )
}

function ChromeButtonCluster({ children, nativeGlassAvailable }: PropsWithChildren<{ nativeGlassAvailable: boolean }>) {
  if (nativeGlassAvailable) {
    return (
      <GlassContainer spacing={12} style={styles.toolbarActions}>
        {children}
      </GlassContainer>
    )
  }

  return <View style={styles.toolbarActions}>{children}</View>
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
  toolbarActions: { flexDirection: 'row', gap: 12 },
  chromeButtonSurface: {
    borderCurve: 'continuous',
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  chromeButtonContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chromeButtonFallback: {
    backgroundColor: 'rgba(20,20,22,0.72)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
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
  glassContentPressed: { opacity: 0.72 },
  fallbackPressed: { opacity: 0.56 },
  missing: { alignItems: 'center', gap: 14, justifyContent: 'center' },
  missingTitle: { color: '#fff', fontFamily: font.ui, fontSize: 18, fontWeight: '600' },
  missingAction: { color: '#0a84ff', fontFamily: font.ui, fontSize: 16, fontWeight: '600' },
})
