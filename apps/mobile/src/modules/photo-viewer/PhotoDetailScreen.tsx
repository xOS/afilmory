import type {
  PhotoDetailActionEvent,
  PhotoDetailIndexChangeEvent,
  PhotoDetailMetadataItem,
  PhotoDetailReactionEvent,
  PhotoDetailReactionItem,
  PhotoDetailStrings,
} from 'photo-masonry'
import { NativePhotoDetailView } from 'photo-masonry'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { getIntlLocale, useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { signInPage } from '@/modules/auth/signInPage'
import { usePhotoCommentCount } from '@/modules/comments/usePhotoCommentCount'
import { buildPhotoMasonryItem } from '@/modules/galleries/photoMasonryItem'
import { buildNativePhotoInfoPayload, presentNativePhotoComments } from '@/native/photoSheets'
import { usePageRuntime } from '@/presentation'
import { font } from '@/theme/tokens'

import type { PhotoDetailRouteParams } from './photoDetailPage'
import { buildPhotoHeaderModel } from './photoHeaderModel'
import { buildPhotoInfoSheetModel } from './photoInfoModel'
import type { PhotoReaction } from './photoReactionState'
import { PHOTO_REACTIONS } from './photoReactionState'
import { getPhotoViewerSession, releasePhotoViewerSession } from './sessionStore'
import { usePhotoReactions } from './usePhotoReactions'

function isPhotoReaction(value: string): value is PhotoReaction {
  return (PHOTO_REACTIONS as readonly string[]).includes(value)
}

export function PhotoDetailScreen() {
  const { cancel, params, present } = usePageRuntime<PhotoDetailRouteParams>()
  const { i18n, t } = useTranslation()
  const session = getPhotoViewerSession(params.sessionId)
  const auth = useAuth()
  const [currentIndex, setCurrentIndex] = useState(session?.initialIndex ?? 0)
  const currentPhoto = session?.photos[currentIndex] ?? null
  const gallerySlug = session?.gallerySlug ?? null
  const intlLocale = getIntlLocale(i18n.resolvedLanguage)
  const { count: commentCount, setCount: setCommentCount } = usePhotoCommentCount(gallerySlug, currentPhoto?.id ?? null)
  const { addReactions, counts, failureNonce } = usePhotoReactions(gallerySlug, currentPhoto?.id ?? null)

  useEffect(() => () => releasePhotoViewerSession(params.sessionId), [params.sessionId])

  const photos = useMemo(
    () =>
      (session?.photos ?? []).map(photo =>
        buildPhotoMasonryItem(photo, t('photo.accessibility', { id: photo.title || photo.id }))),
    [session, t],
  )

  const metadataJSON = useMemo(() => {
    const headerStrings = {
      fallbackTitle: t('page.photo'),
      today: t('photo.captureDay.today'),
      yesterday: t('photo.captureDay.yesterday'),
    }
    const metadata: PhotoDetailMetadataItem[] = (session?.photos ?? []).map((photo) => {
      const header = buildPhotoHeaderModel(photo, intlLocale, headerStrings)
      const info = buildNativePhotoInfoPayload(buildPhotoInfoSheetModel(photo, t, intlLocale))
      return {
        id: photo.id,
        infoJSON: JSON.stringify(info),
        subtitle: header.subtitle,
        title: header.title,
      }
    })
    return JSON.stringify(metadata)
  }, [intlLocale, session, t])

  const stringsJSON = useMemo(() => {
    const strings: PhotoDetailStrings = {
      close: t('photo.close'),
      comments: t('photo.comments'),
      info: t('photo.info'),
      next: t('photo.next'),
      previous: t('photo.previous'),
      reaction: t('photo.reaction.open'),
      share: t('photo.share'),
    }
    return JSON.stringify(strings)
  }, [t])

  const livePhotoStringsJSON = useMemo(
    () =>
      JSON.stringify({
        accessibilityHint: t('photo.livePhotoHint'),
        accessibilityLabel: t('photo.livePhoto'),
        badgeBounce: t('photo.liveBadgeBounce'),
        badgeLive: t('photo.liveBadge'),
        badgeLoop: t('photo.liveBadgeLoop'),
        badgeOff: t('photo.liveBadgeOff'),
        menuBounce: t('photo.liveMode.bounce'),
        menuLive: t('photo.liveMode.live'),
        menuLoop: t('photo.liveMode.loop'),
        menuOff: t('photo.liveMode.off'),
      }),
    [t],
  )

  const reactionItemsJSON = useMemo(() => {
    const items: PhotoDetailReactionItem[] = PHOTO_REACTIONS.map(reaction => ({
      accessibilityLabel: t('photo.reaction.add', { reaction }),
      count: counts[reaction] ?? 0,
      reaction,
    }))
    return JSON.stringify(items)
  }, [counts, t])

  const handleIndexChange = useCallback((event: { nativeEvent: PhotoDetailIndexChangeEvent }) => {
    setCurrentIndex(event.nativeEvent.index)
  }, [])

  const handleCommentsRequest = useCallback(
    (event: { nativeEvent: PhotoDetailActionEvent }) => {
      if (!session?.gallerySlug) {
        return
      }
      const photo = session.photos[event.nativeEvent.index]
      if (!photo || photo.id !== event.nativeEvent.id) {
        return
      }
      void presentNativePhotoComments({
        gallerySlug: session.gallerySlug,
        initialCommentCount: commentCount ?? -1,
        photoId: photo.id,
        photoTitle: photo.title,
        viewerUserId: auth.session?.user.id ?? null,
      })
        .then((result) => {
          setCommentCount(result.commentCount)
          if (result.requestedSignIn) {
            void present(signInPage)
          }
        })
        .catch(() => {
          // Native cancellation and presentation failures leave photo detail unchanged.
        })
    },
    [auth.session?.user.id, commentCount, present, session, setCommentCount],
  )

  const handleReactionRequest = useCallback(
    (event: { nativeEvent: PhotoDetailReactionEvent }) => {
      if (currentPhoto?.id !== event.nativeEvent.id || !isPhotoReaction(event.nativeEvent.reaction)) {
        return
      }
      addReactions(event.nativeEvent.reaction, event.nativeEvent.count)
    },
    [addReactions, currentPhoto?.id],
  )

  if (!session || !currentPhoto) {
    return (
      <View style={[styles.root, styles.missing]}>
        <Text style={styles.missingTitle}>{t('photo.unavailable')}</Text>
        <Pressable accessibilityRole="button" onPress={cancel}>
          <Text style={styles.missingAction}>{t('common.goBack')}</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <NativePhotoDetailView
        commentCount={commentCount ?? -1}
        initialIndex={session.initialIndex}
        livePhotoStringsJSON={livePhotoStringsJSON}
        metadataJSON={metadataJSON}
        photos={photos}
        reactionFailureNonce={failureNonce}
        reactionItemsJSON={reactionItemsJSON}
        socialActionsEnabled={session.gallerySlug !== null}
        stringsJSON={stringsJSON}
        style={styles.nativeDetail}
        testID="photo-detail-native"
        transitionId={session.transitionId}
        onCommentsRequest={handleCommentsRequest}
        onIndexChange={handleIndexChange}
        onReactionRequest={handleReactionRequest}
        onRequestClose={() => cancel()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: 'transparent', flex: 1 },
  nativeDetail: { flex: 1 },
  missing: { alignItems: 'center', backgroundColor: '#000', gap: 14, justifyContent: 'center' },
  missingTitle: { color: '#fff', fontFamily: font.ui, fontSize: 18, fontWeight: '600' },
  missingAction: { color: '#0a84ff', fontFamily: font.ui, fontSize: 16, fontWeight: '600' },
})
