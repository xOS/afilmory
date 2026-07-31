import { GlassContainer, GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect'
import { StatusBar } from 'expo-status-bar'
import { SymbolView } from 'expo-symbols'
import type { PhotoViewerIndexChangeEvent } from 'photo-masonry'
import { PhotoViewerView } from 'photo-masonry'
import type { PropsWithChildren } from 'react'
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { findNodeHandle, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getIntlLocale, useTranslation } from '@/i18n'
import { photoCommentsPage } from '@/modules/comments/photoCommentsPage'
import { usePhotoCommentCount } from '@/modules/comments/usePhotoCommentCount'
import { buildPhotoMasonryItem } from '@/modules/galleries/photoMasonryItem'
import { supportsPhotoInspector } from '@/modules/shell/adaptiveLayout'
import { buildNativePhotoInfoPayload, NativePhotoInfoPanel, presentNativePhotoInfo } from '@/native/photoSheets'
import { usePageRuntime } from '@/presentation'
import { font } from '@/theme/tokens'

import type { PhotoDetailRouteParams } from './photoDetailPage'
import { buildPhotoInfoSheetModel } from './photoInfoModel'
import { PhotoReactionRail } from './PhotoReactionRail'
import { getPhotoViewerSession, releasePhotoViewerSession } from './sessionStore'

type GlassButtonSymbol = 'bubble.left' | 'face.smiling' | 'info.circle' | 'square.and.arrow.up' | 'xmark'

const GLASS_BUTTON_ICON_SIZES: Record<GlassButtonSymbol, number> = {
  'bubble.left': 25,
  'face.smiling': 25,
  'info.circle': 26,
  'square.and.arrow.up': 30,
  'xmark': 23,
}

const INSPECTOR_TRANSITION_DURATION = 320
const INSPECTOR_TRANSITION_EASING = Easing.bezier(0.32, 0.72, 0, 1)
const INSPECTOR_WIDTH = 380

export function PhotoDetailScreen() {
  const { cancel, params, present } = usePageRuntime<PhotoDetailRouteParams>()
  const { i18n, t } = useTranslation()
  const session = getPhotoViewerSession(params.sessionId)
  const [currentIndex, setCurrentIndex] = useState(session?.initialIndex ?? 0)
  const [viewportWidth, setViewportWidth] = useState(0)
  const [infoInspectorVisible, setInfoInspectorVisible] = useState(false)
  const [reactionRailVisible, setReactionRailVisible] = useState(false)
  const shareButtonRef = useRef<View>(null)
  const inspectorProgress = useSharedValue(0)
  const nativeGlassAvailable = Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable()
  const canShowInfoInspector = supportsPhotoInspector(viewportWidth)

  useEffect(() => () => releasePhotoViewerSession(params.sessionId), [params.sessionId])

  const items = useMemo(
    () =>
      session?.photos.map(photo =>
        buildPhotoMasonryItem(photo, t('photo.accessibility', { id: photo.title || photo.id }))) ?? [],
    [session, t],
  )

  const currentPhoto = session?.photos[currentIndex] ?? null
  const { count: commentCount, refresh: refreshCommentCount } = usePhotoCommentCount(
    session?.gallerySlug ?? null,
    currentPhoto?.id ?? null,
  )
  const photoInfo = useMemo(() => {
    if (!currentPhoto) {
      return null
    }
    return buildPhotoInfoSheetModel(currentPhoto, t, getIntlLocale(i18n.resolvedLanguage))
  }, [currentPhoto, i18n.resolvedLanguage, t])
  const nativePhotoInfoJSON = useMemo(
    () => (photoInfo ? JSON.stringify(buildNativePhotoInfoPayload(photoInfo)) : null),
    [photoInfo],
  )
  const inspectorPresented = canShowInfoInspector && infoInspectorVisible && nativePhotoInfoJSON !== null
  const inspectorClipStyle = useAnimatedStyle(() => ({
    width: INSPECTOR_WIDTH * inspectorProgress.get(),
  }))
  const inspectorSurfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: INSPECTOR_WIDTH * (1 - inspectorProgress.get()) }],
  }))
  const closeReactionRail = useCallback(() => setReactionRailVisible(false), [])
  const toggleReactionRail = useCallback(() => setReactionRailVisible(visible => !visible), [])
  const handleIndexChange = useCallback(
    (event: { nativeEvent: PhotoViewerIndexChangeEvent }) => {
      closeReactionRail()
      setCurrentIndex(event.nativeEvent.index)
    },
    [closeReactionRail],
  )
  const openInfo = useCallback(() => {
    if (!photoInfo) {
      return
    }
    closeReactionRail()
    if (canShowInfoInspector) {
      setInfoInspectorVisible(visible => !visible)
    }
    else {
      void presentNativePhotoInfo(photoInfo)
    }
  }, [canShowInfoInspector, closeReactionRail, photoInfo])
  const sharePhoto = useCallback(() => {
    if (!currentPhoto) {
      return
    }
    closeReactionRail()
    const anchor = findNodeHandle(shareButtonRef.current)
    void Share.share(
      {
        message: currentPhoto.title || currentPhoto.originalUrl,
        url: currentPhoto.originalUrl,
      },
      anchor === null ? undefined : { anchor },
    )
  }, [closeReactionRail, currentPhoto])
  const openComments = useCallback(() => {
    if (!currentPhoto || !session?.gallerySlug) {
      return
    }
    closeReactionRail()
    void present(photoCommentsPage, {
      gallerySlug: session.gallerySlug,
      photoId: currentPhoto.id,
      photoTitle: currentPhoto.title,
    }).then(() => refreshCommentCount())
  }, [closeReactionRail, currentPhoto, present, refreshCommentCount, session?.gallerySlug])

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width
    setViewportWidth(current => (current === nextWidth ? current : nextWidth))
  }, [])

  useEffect(() => {
    if (!canShowInfoInspector) {
      setInfoInspectorVisible(false)
    }
  }, [canShowInfoInspector])

  useEffect(() => {
    inspectorProgress.set(
      withTiming(inspectorPresented ? 1 : 0, {
        duration: INSPECTOR_TRANSITION_DURATION,
        easing: INSPECTOR_TRANSITION_EASING,
        reduceMotion: ReduceMotion.System,
      }),
    )
  }, [inspectorPresented, inspectorProgress])

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
    <View style={styles.root} onLayout={handleLayout}>
      <StatusBar style="light" />
      <View style={styles.contentRow}>
        <View style={styles.mediaColumn}>
          <PhotoViewerView
            initialIndex={session.initialIndex}
            interactiveDismissEnabled={!infoInspectorVisible}
            keyboardCloseTitle={t('photo.close')}
            keyboardInfoTitle={t('photo.info')}
            keyboardNextTitle={t('photo.next')}
            keyboardPreviousTitle={t('photo.previous')}
            livePhotoAccessibilityHint={t('photo.livePhotoHint')}
            livePhotoBadgeTitle={t('photo.livePhoto')}
            photos={items}
            style={styles.viewer}
            testID="photo-viewer"
            transitionId={session.transitionId}
            onIndexChange={handleIndexChange}
            onInfoRequest={openInfo}
            onRequestClose={cancel}
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
                  active={canShowInfoInspector && infoInspectorVisible}
                  accessibilityLabel={t('photo.info')}
                  nativeGlassAvailable={nativeGlassAvailable}
                  symbol="info.circle"
                  onPress={openInfo}
                />
                {session.gallerySlug ? (
                  <>
                    <ChromeButton
                      accessibilityLabel={
                        commentCount && commentCount > 0
                          ? `${t('photo.comments')}, ${commentCount}`
                          : t('photo.comments')
                      }
                      badge={commentCount}
                      nativeGlassAvailable={nativeGlassAvailable}
                      symbol="bubble.left"
                      onPress={openComments}
                    />
                    <ChromeButton
                      active={reactionRailVisible}
                      accessibilityLabel={t('photo.reaction.open')}
                      expanded={reactionRailVisible}
                      nativeGlassAvailable={nativeGlassAvailable}
                      symbol="face.smiling"
                      onPress={toggleReactionRail}
                    />
                  </>
                ) : null}
                <ChromeButton
                  ref={shareButtonRef}
                  accessibilityLabel={t('photo.share')}
                  nativeGlassAvailable={nativeGlassAvailable}
                  symbol="square.and.arrow.up"
                  onPress={sharePhoto}
                />
              </ChromeButtonCluster>
            </View>
            {session.gallerySlug ? (
              <PhotoReactionRail
                key={`${session.gallerySlug}:${currentPhoto.id}`}
                gallerySlug={session.gallerySlug}
                nativeGlassAvailable={nativeGlassAvailable}
                photoId={currentPhoto.id}
                visible={reactionRailVisible}
                onReactionSelected={closeReactionRail}
              />
            ) : null}
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

        {canShowInfoInspector && nativePhotoInfoJSON ? (
          <Animated.View
            accessibilityElementsHidden={!inspectorPresented}
            pointerEvents={inspectorPresented ? 'auto' : 'none'}
            style={[styles.infoInspectorClip, inspectorClipStyle]}
          >
            <Animated.View style={[styles.infoInspectorContainer, inspectorSurfaceStyle]}>
              <NativePhotoInfoPanel
                infoJSON={nativePhotoInfoJSON}
                style={styles.infoInspector}
                onClose={() => setInfoInspectorVisible(false)}
              />
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  )
}

interface ChromeButtonProps {
  active?: boolean
  accessibilityLabel: string
  badge?: number | null
  expanded?: boolean
  nativeGlassAvailable: boolean
  onPress: () => void
  symbol: GlassButtonSymbol
}

const ChromeButton = forwardRef<View, ChromeButtonProps>(
  ({ active = false, accessibilityLabel, badge, expanded, nativeGlassAvailable, onPress, symbol }, ref) => {
    const content = (
      <View style={styles.chromeButtonIcon}>
        <SymbolView
          name={symbol}
          scale="large"
          size={GLASS_BUTTON_ICON_SIZES[symbol]}
          tintColor={active ? '#0a84ff' : '#fff'}
          weight="regular"
        />
        {badge && badge > 0 ? (
          <View style={styles.commentBadge}>
            <Text style={styles.commentBadgeLabel}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
    )

    if (nativeGlassAvailable) {
      return (
        <GlassView colorScheme="dark" glassEffectStyle="regular" isInteractive style={styles.chromeButtonSurface}>
          <Pressable
            ref={ref}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={expanded === undefined ? undefined : { expanded }}
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
        ref={ref}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        accessibilityState={expanded === undefined ? undefined : { expanded }}
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
  },
)
ChromeButton.displayName = 'ChromeButton'

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
  contentRow: { flex: 1, flexDirection: 'row', overflow: 'hidden' },
  mediaColumn: { flex: 1 },
  infoInspectorClip: { overflow: 'hidden' },
  infoInspectorContainer: {
    backgroundColor: '#1c1c1e',
    borderLeftColor: 'rgba(255,255,255,0.14)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: INSPECTOR_WIDTH,
  },
  infoInspector: { flex: 1 },
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
  chromeButtonIcon: { alignItems: 'center', justifyContent: 'center' },
  commentBadge: {
    alignItems: 'center',
    backgroundColor: '#0a84ff',
    borderColor: 'rgba(0,0,0,0.72)',
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 16,
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -9,
    top: -8,
  },
  commentBadgeLabel: {
    color: '#fff',
    fontFamily: font.ui,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
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
