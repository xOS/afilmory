import type { FlashListRef, ListRenderItem } from '@shopify/flash-list'
import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { SymbolView } from 'expo-symbols'
import type { RefObject } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'

import { getIntlLocale, useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { SignInSection } from '@/modules/auth/SignInSection'
import { usePageRuntime } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { httpStatus } from './api'
import { COMMENT_BUBBLE_MAX_WIDTH, CommentBubbleSurface, CommentBubbleText } from './CommentBubble'
import type { CommentFlightRect } from './CommentSendFlight'
import { CommentSendFlight, readRelativeRect } from './CommentSendFlight'
import { formatCommentRelativeTime } from './commentState'
import type { PhotoCommentsPageParams } from './photoCommentsPage'
import type { CommentUser, PhotoComment } from './types'
import { usePhotoComments } from './usePhotoComments'

const COMMENT_MAX_LENGTH = 1000
const URL_PATTERN = /((?:https?:\/\/|www\.)\S+)/g
const styleCache = new WeakMap<Palette, ReturnType<typeof createStyles>>()
let nextCommentFlightId = 0

interface CommentFlight {
  clientId: string
  content: string
  origin: CommentFlightRect
  target: CommentFlightRect | null
}

function createCommentFlightId(): string {
  nextCommentFlightId += 1
  return `comment-send-${Date.now()}-${nextCommentFlightId}`
}

function useCommentStyles() {
  const { palette } = useTheme()
  const cached = styleCache.get(palette)
  if (cached) {
    return cached
  }
  const styles = createStyles(palette)
  styleCache.set(palette, styles)
  return styles
}

export function PhotoCommentsScreen() {
  const { cancel, params } = usePageRuntime<PhotoCommentsPageParams>()
  const { i18n, t } = useTranslation()
  const { palette } = useTheme()
  const styles = useCommentStyles()
  const auth = useAuth()
  const reducedMotion = useReducedMotion()
  const {
    collection,
    create: createComment,
    error: loadError,
    loadMore,
    loading,
    loadingMore,
    nextCursor,
    reactionBusyIds,
    refresh,
    refreshing,
    submitting,
    toggleReaction,
  } = usePhotoComments(params.gallerySlug, params.photoId, auth.session?.user.id ?? null)
  const rootRef = useRef<View>(null)
  const listRef = useRef<FlashListRef<PhotoComment>>(null)
  const inputRef = useRef<TextInput>(null)
  const flightTargetRef = useRef<View>(null)
  const flightMeasureFrameRef = useRef<number | null>(null)
  const flightScrollReadyRef = useRef(false)
  const submitLockRef = useRef(false)
  const [draft, setDraft] = useState('')
  const [replyToId, setReplyToId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [flight, setFlight] = useState<CommentFlight | null>(null)
  const flightRef = useRef(flight)
  flightRef.current = flight

  const locale = getIntlLocale(i18n.resolvedLanguage)
  const { comments, relations, users } = collection
  const replyTo = replyToId
    ? (comments.find(comment => comment.id === replyToId) ?? relations[replyToId] ?? null)
    : null
  const replyUser = replyTo ? users[replyTo.userId] : null
  const replyAuthor = replyTo ? authorName(replyTo, replyUser, auth.session?.user.id ?? null, t) : ''
  const signedIn = auth.status === 'signedIn'

  const completeFlight = useCallback((clientId: string) => {
    flightScrollReadyRef.current = false
    setFlight(current => (current?.clientId === clientId ? null : current))
  }, [])

  const measureFlightTarget = useCallback(() => {
    const current = flightRef.current
    if (!current || current.target) {
      return
    }
    const target = readRelativeRect(flightTargetRef.current, rootRef.current)
    if (!target) {
      return
    }
    setFlight(active => (active?.clientId === current.clientId && !active.target ? { ...active, target } : active))
  }, [])

  const scheduleFlightTargetMeasurement = useCallback(() => {
    if (!flightScrollReadyRef.current) {
      return
    }
    if (flightMeasureFrameRef.current !== null) {
      cancelAnimationFrame(flightMeasureFrameRef.current)
    }
    flightMeasureFrameRef.current = requestAnimationFrame(() => {
      flightMeasureFrameRef.current = null
      measureFlightTarget()
    })
  }, [measureFlightTarget])

  useEffect(
    () => () => {
      if (flightMeasureFrameRef.current !== null) {
        cancelAnimationFrame(flightMeasureFrameRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (!flight || flight.target) {
      return
    }
    const index = comments.findIndex(comment => (comment.clientId ?? comment.id) === flight.clientId)
    if (index < 0) {
      return
    }
    let active = true
    flightScrollReadyRef.current = false
    const scrollPromise = listRef.current?.scrollToIndex({ animated: false, index, viewPosition: 1 })
    void scrollPromise
      ?.catch(() => {})
      .finally(() => {
        if (active) {
          flightScrollReadyRef.current = true
          scheduleFlightTargetMeasurement()
        }
      })
    const fallbackTimer = setTimeout(completeFlight, 900, flight.clientId)
    return () => {
      active = false
      clearTimeout(fallbackTimer)
    }
  }, [comments, completeFlight, flight, scheduleFlightTargetMeasurement])

  const handleReply = useCallback((commentId: string) => {
    setReplyToId(commentId)
    setSubmitError(null)
  }, [])

  useEffect(() => {
    if (signedIn) {
      setActionError(null)
      if (replyToId) {
        requestAnimationFrame(() => inputRef.current?.focus())
      }
    }
  }, [replyToId, signedIn])

  const handleReaction = useCallback(
    async (commentId: string) => {
      setActionError(null)
      if (auth.status !== 'signedIn') {
        const message = t('comments.loginRequired')
        setActionError(message)
        AccessibilityInfo.announceForAccessibility(message)
        return
      }
      try {
        await toggleReaction(commentId)
      }
      catch {
        setActionError(t('comments.reactionFailed'))
        AccessibilityInfo.announceForAccessibility(t('comments.reactionFailed'))
      }
    },
    [auth.status, t, toggleReaction],
  )

  const handleSubmit = useCallback(async () => {
    const content = draft.trim()
    if (!content || submitting || submitLockRef.current) {
      return
    }
    const sessionUser = auth.session?.user
    if (!signedIn || !sessionUser) {
      return
    }

    const clientId = createCommentFlightId()
    const parentId = replyToId
    const origin = reducedMotion ? null : readRelativeRect(inputRef.current, rootRef.current)
    submitLockRef.current = true
    flightTargetRef.current = null
    flightScrollReadyRef.current = false
    setSubmitError(null)
    setDraft('')
    setReplyToId(null)
    if (origin) {
      setFlight({ clientId, content, origin, target: null })
    }
    try {
      const creation = createComment({
        clientId,
        content,
        parentId,
        user: {
          id: sessionUser.id,
          image: sessionUser.image ?? null,
          name: sessionUser.name,
        },
      })
      requestAnimationFrame(() => {
        void listRef.current
          ?.scrollToIndex({
            animated: false,
            index: comments.length,
            viewPosition: 1,
          })
          .catch(() => {})
      })
      await creation
      AccessibilityInfo.announceForAccessibility(t('comments.posted'))
    }
    catch (error) {
      completeFlight(clientId)
      setDraft(content)
      setReplyToId(parentId)
      const message = t(httpStatus(error) === 401 ? 'comments.loginRequired' : 'comments.postFailed')
      setSubmitError(message)
      AccessibilityInfo.announceForAccessibility(message)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    finally {
      submitLockRef.current = false
    }
  }, [
    auth.session?.user,
    comments.length,
    completeFlight,
    createComment,
    draft,
    reducedMotion,
    replyToId,
    signedIn,
    submitting,
    t,
  ])

  const renderComment = useCallback<ListRenderItem<PhotoComment>>(
    ({ item }) => {
      const user = users[item.userId]
      const parent = item.parentId ? relations[item.parentId] : null
      const parentUser = parent ? users[parent.userId] : null
      const clientId = item.clientId ?? item.id
      const flightTarget = flight?.clientId === clientId
      return (
        <CommentCard
          author={authorName(item, user, auth.session?.user.id ?? null, t)}
          avatarUrl={user?.image ?? null}
          commentId={item.id}
          content={item.content}
          createdAt={item.createdAt}
          flightHidden={flightTarget}
          landingRef={flightTarget ? flightTargetRef : null}
          locale={locale}
          own={Boolean(auth.session?.user.id && item.userId === auth.session.user.id)}
          onLandingLayout={flightTarget ? scheduleFlightTargetMeasurement : undefined}
          parentAuthor={parent ? authorName(parent, parentUser, auth.session?.user.id ?? null, t) : null}
          parentContent={parent?.content ?? null}
          pending={item.status === 'pending'}
          reacted={item.viewerReactions.includes('like')}
          reactionBusy={reactionBusyIds.has(item.id)}
          reactionCount={item.reactionCounts.like ?? 0}
          sending={item.deliveryState === 'sending'}
          userId={item.userId}
          website={user?.website ?? null}
          onReaction={handleReaction}
          onReply={handleReply}
        />
      )
    },
    [
      auth.session?.user.id,
      flight?.clientId,
      handleReaction,
      handleReply,
      locale,
      reactionBusyIds,
      relations,
      scheduleFlightTargetMeasurement,
      t,
      users,
    ],
  )

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return <ActivityIndicator color={palette.textSecondary} style={styles.footerSpinner} />
    }
    if (loadError && comments.length > 0) {
      return <CommentFooterError onRetry={() => void refresh()} />
    }
    if (nextCursor) {
      return (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.loadMoreButton, pressed && styles.pressed]}
          onPress={() => void loadMore()}
        >
          <SymbolView name="arrow.down" size={14} tintColor={palette.textSecondary} />
          <Text style={styles.loadMoreLabel}>{t('comments.loadMore')}</Text>
        </Pressable>
      )
    }
    return <View style={styles.footerSpacer} />
  }, [comments.length, loadError, loadMore, loadingMore, nextCursor, palette.textSecondary, refresh, styles, t])

  const listBody
    = loading && comments.length === 0 ? (
      <CommentSkeleton />
    ) : loadError && comments.length === 0 ? (
      <CommentErrorState onRetry={() => void refresh()} />
    ) : (
      <FlashList
        ref={listRef}
        contentContainerStyle={styles.listContent}
        contentInsetAdjustmentBehavior="automatic"
        data={comments}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        keyExtractor={commentKey}
        ListEmptyComponent={CommentEmptyState}
        ListFooterComponent={listFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} tintColor={palette.textSecondary} onRefresh={() => void refresh()} />
        }
        renderItem={renderComment}
        showsVerticalScrollIndicator={false}
        style={styles.list}
      />
    )

  return (
    <View ref={rootRef} style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{t('inspector.tab.comments')}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {params.photoTitle || t('page.photo')}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={t('common.done')}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          onPress={cancel}
        >
          <SymbolView name="xmark" size={15} tintColor={palette.textPrimary} weight="semibold" />
        </Pressable>
      </View>

      {actionError && comments.length > 0 ? (
        <InlineError message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      {listBody}

      {auth.status === 'loading' ? (
        <SafeAreaView edges={['bottom']} style={styles.authLoading}>
          <ActivityIndicator color={palette.textSecondary} />
        </SafeAreaView>
      ) : signedIn ? (
        <CommentComposer
          draft={draft}
          error={submitError}
          inputRef={inputRef}
          replyAuthor={replyAuthor}
          submitting={submitting}
          onCancelReply={() => setReplyToId(null)}
          onChange={(value) => {
            setDraft(value)
            if (submitError) {
              setSubmitError(null)
            }
          }}
          onDismissError={() => setSubmitError(null)}
          onSubmit={() => void handleSubmit()}
        />
      ) : (
        <CommentSignInPanel />
      )}

      {flight ? (
        <CommentSendFlight
          clientId={flight.clientId}
          content={flight.content}
          origin={flight.origin}
          target={flight.target}
          onComplete={completeFlight}
        />
      ) : null}
    </View>
  )
}

function commentKey(comment: PhotoComment): string {
  return comment.clientId ?? comment.id
}

function authorName(
  comment: PhotoComment,
  user: CommentUser | null | undefined,
  sessionUserId: string | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  if (sessionUserId && comment.userId === sessionUserId) {
    return t('comments.you')
  }
  if (user?.name) {
    return user.name
  }
  if (comment.userId) {
    return t('comments.user', { id: comment.userId.slice(-6) })
  }
  return t('comments.anonymous')
}

interface CommentCardProps {
  author: string
  avatarUrl: string | null
  commentId: string
  content: string
  createdAt: string
  flightHidden: boolean
  landingRef: RefObject<View | null> | null
  locale: string
  own: boolean
  onLandingLayout?: () => void
  onReaction: (commentId: string) => void
  onReply: (commentId: string) => void
  parentAuthor: string | null
  parentContent: string | null
  pending: boolean
  reacted: boolean
  reactionBusy: boolean
  reactionCount: number
  sending: boolean
  userId: string
  website: string | null
}

const CommentCard = memo(
  ({
    author,
    avatarUrl,
    commentId,
    content,
    createdAt,
    flightHidden,
    landingRef,
    locale,
    own,
    onLandingLayout,
    onReaction,
    onReply,
    parentAuthor,
    parentContent,
    pending,
    reacted,
    reactionBusy,
    reactionCount,
    sending,
    userId,
    website,
  }: CommentCardProps) => {
    const { palette } = useTheme()
    const { t } = useTranslation()
    const styles = useCommentStyles()
    const time = formatCommentRelativeTime(createdAt, locale)
    const profileUrl = normalizeHttpUrl(website)

    return (
      <View
        style={[
          styles.commentRow,
          own ? styles.commentRowOwn : styles.commentRowIncoming,
          flightHidden && styles.flightTargetHidden,
        ]}
      >
        {own ? null : <Avatar image={avatarUrl} name={author || userId} recyclingKey={userId} size={30} />}
        <View style={[styles.commentBody, own && styles.commentBodyOwn]}>
          {own ? null : (
            <View style={styles.commentHeader}>
              <Text
                accessibilityRole={profileUrl ? 'link' : undefined}
                numberOfLines={1}
                style={styles.author}
                onPress={profileUrl ? () => openExternalUrl(profileUrl) : undefined}
              >
                {author}
              </Text>
              {time ? <Text style={styles.time}>{time}</Text> : null}
            </View>
          )}

          <CommentBubbleSurface
            ref={landingRef}
            own={own}
            style={[styles.commentBubble, own && styles.commentBubbleOwn]}
            onLayout={onLandingLayout}
          >
            {parentContent ? (
              <View style={[styles.parentPreview, own && styles.parentPreviewOwn]}>
                <View style={styles.parentLabelRow}>
                  <SymbolView
                    name="arrowshape.turn.up.left"
                    size={11}
                    tintColor={own ? 'rgba(255, 255, 255, 0.7)' : palette.textMuted}
                  />
                  <Text numberOfLines={1} style={[styles.parentLabel, own && styles.parentLabelOwn]}>
                    {t('comments.replyingToPlain', { user: parentAuthor })}
                  </Text>
                </View>
                <Text numberOfLines={3} style={[styles.parentContent, own && styles.parentContentOwn]}>
                  {parentContent}
                </Text>
              </View>
            ) : null}

            <LinkedCommentText content={content} own={own} />
          </CommentBubbleSurface>

          <View style={[styles.commentFooter, own && styles.commentFooterOwn]}>
            {own && time ? <Text style={styles.time}>{time}</Text> : null}
            {sending ? (
              <View accessibilityLabel={t('comments.sending')} style={styles.sendingState}>
                <ActivityIndicator color={palette.textMuted} size="small" style={styles.sendingSpinner} />
                <Text style={styles.sendingLabel}>{t('comments.sending')}</Text>
              </View>
            ) : pending ? (
              <Text style={styles.pending}>{t('comments.pending')}</Text>
            ) : null}
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel={t(reacted ? 'comments.unlike' : 'comments.like')}
                accessibilityRole="button"
                disabled={reactionBusy || sending}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.actionButton,
                  reacted && styles.actionButtonActive,
                  sending && styles.actionButtonDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => onReaction(commentId)}
              >
                {reactionBusy ? (
                  <ActivityIndicator color={palette.accent} size="small" style={styles.reactionSpinner} />
                ) : (
                  <SymbolView
                    name={reacted ? 'heart.fill' : 'heart'}
                    size={13}
                    tintColor={reacted ? palette.accentHi : palette.textSecondary}
                  />
                )}
                <Text style={[styles.actionLabel, reacted && styles.actionLabelActive]}>{reactionCount}</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={t('comments.reply')}
                accessibilityRole="button"
                disabled={sending}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.actionButton,
                  sending && styles.actionButtonDisabled,
                  pressed && styles.pressed,
                ]}
                onPress={() => onReply(commentId)}
              >
                <SymbolView name="arrowshape.turn.up.left" size={12} tintColor={palette.textSecondary} />
                <Text style={styles.actionLabel}>{t('comments.reply')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    )
  },
)
CommentCard.displayName = 'CommentCard'

function normalizeHttpUrl(value: string | null): string | null {
  if (!value) {
    return null
  }
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  }
  catch {
    return null
  }
}

function openExternalUrl(url: string): void {
  void Linking.openURL(url).catch(() => {})
}

function LinkedCommentText({ content, own }: { content: string, own: boolean }) {
  const { palette } = useTheme()
  const styles = useCommentStyles()
  const parts = useMemo(() => {
    let offset = 0
    return content.split(URL_PATTERN).map((part) => {
      const item = { key: `${offset}-${part}`, value: part }
      offset += part.length
      return item
    })
  }, [content])
  return (
    <CommentBubbleText selectable own={own}>
      {parts.map((part) => {
        const isUrl = /^(?:https?:\/\/|www\.)/.test(part.value)
        if (!isUrl) {
          return part.value
        }
        const url = part.value.startsWith('www.') ? `https://${part.value}` : part.value
        return (
          <Text
            key={part.key}
            accessibilityRole="link"
            style={[styles.link, own && { color: palette.accentContrast }]}
            onPress={() => openExternalUrl(url)}
          >
            {part.value}
          </Text>
        )
      })}
    </CommentBubbleText>
  )
}

function CommentComposer({
  draft,
  error,
  inputRef,
  onCancelReply,
  onChange,
  onDismissError,
  onSubmit,
  replyAuthor,
  submitting,
}: {
  draft: string
  error: string | null
  inputRef: React.RefObject<TextInput | null>
  onCancelReply: () => void
  onChange: (value: string) => void
  onDismissError: () => void
  onSubmit: () => void
  replyAuthor: string
  submitting: boolean
}) {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useCommentStyles()
  const canSubmit = draft.trim().length > 0 && !submitting

  return (
    <SafeAreaView edges={['bottom']} style={styles.composerSurface}>
      {error ? <InlineError message={error} onDismiss={onDismissError} /> : null}
      {replyAuthor ? (
        <View style={styles.replyBanner}>
          <SymbolView name="arrowshape.turn.up.left" size={12} tintColor={palette.textSecondary} />
          <Text numberOfLines={1} style={styles.replyBannerLabel}>
            {t('comments.replyingToPlain', { user: replyAuthor })}
          </Text>
          <Pressable
            accessibilityLabel={t('comments.cancelReply')}
            accessibilityRole="button"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
            onPress={onCancelReply}
          >
            <SymbolView name="xmark" size={12} tintColor={palette.textSecondary} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <View style={styles.composerPill}>
          <TextInput
            ref={inputRef}
            accessibilityLabel={t('comments.placeholder')}
            autoCorrect
            editable={!submitting}
            maxLength={COMMENT_MAX_LENGTH}
            multiline
            placeholder={t('comments.placeholder')}
            placeholderTextColor={palette.textMuted}
            scrollEnabled
            selectionColor={palette.accent}
            style={styles.input}
            textAlignVertical="top"
            value={draft}
            onChangeText={onChange}
          />
          <Pressable
            accessibilityLabel={t('comments.send')}
            accessibilityRole="button"
            disabled={!canSubmit}
            hitSlop={6}
            style={({ pressed }) => [
              styles.sendButton,
              !canSubmit && styles.sendButtonDisabled,
              pressed && canSubmit && styles.pressed,
            ]}
            onPress={onSubmit}
          >
            {submitting ? (
              <ActivityIndicator color={palette.accentContrast} size="small" />
            ) : (
              <SymbolView name="arrow.up" size={16} tintColor={palette.accentContrast} weight="bold" />
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  )
}

function CommentSignInPanel() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useCommentStyles()
  return (
    <SafeAreaView edges={['bottom']} style={styles.signInSurface}>
      <View style={styles.signInCopy}>
        <SymbolView name="person.crop.circle" size={22} tintColor={palette.textSecondary} />
        <Text style={styles.signInLabel}>{t('comments.loginRequired')}</Text>
      </View>
      <SignInSection compact />
    </SafeAreaView>
  )
}

function Avatar({
  image,
  name,
  recyclingKey,
  size,
}: {
  image: string | null
  name: string
  recyclingKey: string
  size: number
}) {
  const styles = useCommentStyles()
  const sizeStyle = useMemo(() => ({ height: size, width: size }), [size])
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?'
  return (
    <View style={[styles.avatar, sizeStyle]}>
      {image ? (
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          recyclingKey={recyclingKey}
          source={{ uri: image }}
          style={styles.avatarImage}
          transition={120}
        />
      ) : (
        <Text style={styles.avatarInitial}>{initial}</Text>
      )}
    </View>
  )
}

function CommentSkeleton() {
  const styles = useCommentStyles()
  return (
    <View style={styles.skeletonList}>
      {['first', 'second', 'third'].map(key => (
        <View key={key} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonBody}>
            <View style={styles.skeletonHeader} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </View>
        </View>
      ))}
    </View>
  )
}

function CommentEmptyState() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useCommentStyles()
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <SymbolView name="bubble.left" size={30} tintColor={palette.textMuted} />
      </View>
      <Text style={styles.emptyLabel}>{t('comments.empty')}</Text>
    </View>
  )
}

function CommentErrorState({ onRetry }: { onRetry: () => void }) {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useCommentStyles()
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <SymbolView name="exclamationmark.triangle" size={27} tintColor={palette.textSecondary} />
      </View>
      <Text style={styles.emptyLabel}>{t('comments.error')}</Text>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
        onPress={onRetry}
      >
        <Text style={styles.retryLabel}>{t('comments.retry')}</Text>
      </Pressable>
    </View>
  )
}

function CommentFooterError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const styles = useCommentStyles()
  return (
    <View style={styles.footerError}>
      <Text style={styles.footerErrorLabel}>{t('comments.error')}</Text>
      <Pressable
        accessibilityRole="button"
        hitSlop={6}
        style={({ pressed }) => pressed && styles.pressed}
        onPress={onRetry}
      >
        <Text style={styles.footerRetryLabel}>{t('comments.retry')}</Text>
      </Pressable>
    </View>
  )
}

function InlineError({ message, onDismiss }: { message: string, onDismiss: () => void }) {
  const { palette } = useTheme()
  const styles = useCommentStyles()
  return (
    <View accessibilityRole="alert" style={styles.inlineError}>
      <SymbolView name="exclamationmark.circle" size={14} tintColor={palette.danger} />
      <Text style={styles.inlineErrorLabel}>{message}</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onDismiss}>
        <SymbolView name="xmark" size={11} tintColor={palette.danger} />
      </Pressable>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { backgroundColor: palette.bgSurface, flex: 1 },
    header: {
      alignItems: 'center',
      borderBottomColor: palette.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      minHeight: 62,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    headerCopy: { flex: 1, minWidth: 0 },
    title: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    subtitle: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 12,
      marginTop: 2,
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 15,
      height: 30,
      justifyContent: 'center',
      marginLeft: 12,
      width: 30,
    },
    list: { flex: 1 },
    listContent: { paddingBottom: 16, paddingHorizontal: 12, paddingTop: 10 },
    commentRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 6,
    },
    commentRowIncoming: { paddingRight: 42 },
    commentRowOwn: { justifyContent: 'flex-end', paddingLeft: 48 },
    flightTargetHidden: { opacity: 0 },
    commentBody: { flex: 1, gap: 4, minWidth: 0 },
    commentBodyOwn: { alignItems: 'flex-end' },
    commentHeader: { alignItems: 'center', flexDirection: 'row', gap: 7, marginLeft: 8 },
    author: {
      color: palette.textPrimary,
      flexShrink: 1,
      fontFamily: font.ui,
      fontSize: 12,
      fontWeight: '600',
    },
    time: { color: palette.textMuted, fontFamily: font.ui, fontSize: 10 },
    pending: {
      backgroundColor: 'rgba(255, 159, 10, 0.13)',
      borderCurve: 'continuous',
      borderRadius: 999,
      color: '#ffd08a',
      fontFamily: font.ui,
      fontSize: 9,
      fontWeight: '700',
      overflow: 'hidden',
      paddingHorizontal: 7,
      paddingVertical: 2,
      textTransform: 'uppercase',
    },
    commentBubble: { alignSelf: 'flex-start', gap: 6, maxWidth: COMMENT_BUBBLE_MAX_WIDTH },
    commentBubbleOwn: { alignSelf: 'flex-end' },
    link: { color: palette.accentHi, textDecorationLine: 'underline' },
    parentPreview: {
      backgroundColor: palette.bgHover,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    parentPreviewOwn: {
      backgroundColor: 'rgba(0, 0, 0, 0.16)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    parentLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 5 },
    parentLabel: { color: palette.textMuted, flex: 1, fontFamily: font.ui, fontSize: 10 },
    parentLabelOwn: { color: 'rgba(255, 255, 255, 0.72)' },
    parentContent: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 12, lineHeight: 17 },
    parentContentOwn: { color: palette.accentContrast },
    commentFooter: { alignItems: 'center', flexDirection: 'row', gap: 4, marginLeft: 3, minHeight: 26 },
    commentFooterOwn: { alignSelf: 'flex-end', justifyContent: 'flex-end', marginLeft: 0, marginRight: 3 },
    actions: { alignItems: 'center', flexDirection: 'row', gap: 2 },
    actionButton: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 4,
      minHeight: 26,
      paddingHorizontal: 6,
    },
    actionButtonActive: { backgroundColor: palette.accentDim },
    actionButtonDisabled: { opacity: 0.38 },
    actionLabel: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 11, fontWeight: '500' },
    actionLabelActive: { color: palette.accentHi },
    reactionSpinner: { height: 14, transform: [{ scale: 0.65 }], width: 14 },
    sendingState: { alignItems: 'center', flexDirection: 'row', gap: 4 },
    sendingSpinner: { height: 12, transform: [{ scale: 0.55 }], width: 12 },
    sendingLabel: { color: palette.textMuted, fontFamily: font.ui, fontSize: 10 },
    avatar: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { height: '100%', width: '100%' },
    avatarInitial: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 13, fontWeight: '600' },
    footerSpinner: { marginVertical: 18 },
    footerSpacer: { height: 12 },
    footerError: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      paddingVertical: 16,
    },
    footerErrorLabel: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 12 },
    footerRetryLabel: { color: palette.accentHi, fontFamily: font.ui, fontSize: 12, fontWeight: '600' },
    loadMoreButton: {
      alignItems: 'center',
      alignSelf: 'center',
      backgroundColor: palette.bgElement,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 7,
      marginVertical: 14,
      paddingHorizontal: 16,
      paddingVertical: 9,
    },
    loadMoreLabel: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 13, fontWeight: '600' },
    emptyState: {
      alignItems: 'center',
      gap: 12,
      justifyContent: 'center',
      minHeight: 260,
      paddingHorizontal: 32,
      paddingVertical: 44,
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    emptyLabel: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    retryButton: {
      backgroundColor: palette.accent,
      borderCurve: 'continuous',
      borderRadius: 999,
      paddingHorizontal: 17,
      paddingVertical: 8,
    },
    retryLabel: { color: palette.accentContrast, fontFamily: font.ui, fontSize: 13, fontWeight: '600' },
    skeletonList: { gap: 0, paddingHorizontal: 16, paddingTop: 8 },
    skeletonRow: {
      borderBottomColor: palette.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 11,
      paddingVertical: 15,
    },
    skeletonAvatar: { backgroundColor: palette.bgElement, borderRadius: 18, height: 36, width: 36 },
    skeletonBody: { flex: 1, gap: 9, paddingTop: 2 },
    skeletonHeader: { backgroundColor: palette.bgElement, borderRadius: 4, height: 11, width: '35%' },
    skeletonLine: { backgroundColor: palette.bgElement, borderRadius: 4, height: 11, width: '92%' },
    skeletonLineShort: { width: '62%' },
    composerSurface: {
      backgroundColor: palette.bgSurface,
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    composerRow: { flexDirection: 'row', paddingBottom: 4 },
    composerPill: {
      alignItems: 'flex-end',
      backgroundColor: palette.bgElement,
      borderColor: palette.borderStrong,
      borderCurve: 'continuous',
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      flexDirection: 'row',
      padding: 3,
    },
    input: {
      color: palette.textPrimary,
      flex: 1,
      fontFamily: font.ui,
      fontSize: 14,
      lineHeight: 19,
      maxHeight: 112,
      minHeight: 38,
      paddingBottom: 8,
      paddingHorizontal: 11,
      paddingTop: 8,
    },
    sendButton: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderCurve: 'continuous',
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      marginBottom: 1,
      width: 32,
    },
    sendButtonDisabled: { opacity: 0.38 },
    replyBanner: {
      alignItems: 'center',
      backgroundColor: palette.accentDim,
      borderColor: palette.accentLine,
      borderCurve: 'continuous',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 7,
      marginBottom: 9,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    replyBannerLabel: { color: palette.textSecondary, flex: 1, fontFamily: font.ui, fontSize: 12 },
    inlineError: {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 69, 58, 0.1)',
      borderColor: 'rgba(255, 69, 58, 0.3)',
      borderCurve: 'continuous',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 7,
      marginHorizontal: 12,
      marginVertical: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    inlineErrorLabel: { color: palette.danger, flex: 1, fontFamily: font.ui, fontSize: 12 },
    signInSurface: {
      backgroundColor: palette.bgSurface,
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 12,
      paddingHorizontal: 14,
      paddingTop: 11,
    },
    signInCopy: { alignItems: 'center', flexDirection: 'row', gap: 9 },
    signInLabel: { color: palette.textSecondary, flex: 1, fontFamily: font.ui, fontSize: 12, lineHeight: 17 },
    authLoading: {
      alignItems: 'center',
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      minHeight: 64,
      paddingTop: 18,
    },
    pressed: { opacity: 0.58 },
  })
}
