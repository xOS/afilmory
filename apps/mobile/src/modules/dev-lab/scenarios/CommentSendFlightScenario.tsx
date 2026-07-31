import { SymbolView } from 'expo-symbols'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { COMMENT_BUBBLE_MAX_WIDTH, CommentBubbleSurface, CommentBubbleText } from '@/modules/comments/CommentBubble'
import type { CommentFlightRect } from '@/modules/comments/CommentSendFlight'
import { CommentSendFlight, readRelativeRect } from '@/modules/comments/CommentSendFlight'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import type { CommentSendScenarioParams } from '../params'

interface DemoComment {
  author: string
  content: string
  delivery: 'sending' | 'sent' | 'stable'
  id: string
  time: string
}

interface DemoFlight {
  clientId: string
  content: string
  origin: CommentFlightRect
  target: CommentFlightRect | null
}

const INITIAL_COMMENTS: DemoComment[] = [
  {
    author: 'Mira',
    content: 'The light across the foreground is excellent.',
    delivery: 'stable',
    id: 'initial-1',
    time: '2 min',
  },
  {
    author: 'Noah',
    content: 'This frame feels unusually calm.',
    delivery: 'stable',
    id: 'initial-2',
    time: 'now',
  },
]

let nextPreviewCommentId = 0

function createPreviewCommentId(): string {
  nextPreviewCommentId += 1
  return `dev-comment-${Date.now()}-${nextPreviewCommentId}`
}

export function CommentSendFlightScenario({ params }: { params: CommentSendScenarioParams }) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const rootRef = useRef<View>(null)
  const inputRef = useRef<TextInput>(null)
  const targetRef = useRef<View>(null)
  const flightRef = useRef<DemoFlight | null>(null)
  const measurementFrameRef = useRef<number | null>(null)
  const deliveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [comments, setComments] = useState<DemoComment[]>(INITIAL_COMMENTS)
  const [draft, setDraft] = useState(params.message)
  const [error, setError] = useState<string | null>(null)
  const [flight, setFlight] = useState<DemoFlight | null>(null)
  flightRef.current = flight

  const sending = comments.some(comment => comment.delivery === 'sending')
  const busy = sending || flight !== null
  const reduceMotion = params.motion === 'system' ? undefined : params.motion === 'always'

  const clearScheduledWork = useCallback(() => {
    if (measurementFrameRef.current !== null) {
      cancelAnimationFrame(measurementFrameRef.current)
      measurementFrameRef.current = null
    }
    if (deliveryTimerRef.current !== null) {
      clearTimeout(deliveryTimerRef.current)
      deliveryTimerRef.current = null
    }
  }, [])

  const resetPreview = useCallback(() => {
    clearScheduledWork()
    targetRef.current = null
    setComments(INITIAL_COMMENTS)
    setDraft(params.message)
    setError(null)
    setFlight(null)
  }, [clearScheduledWork, params.message])

  useEffect(() => {
    resetPreview()
    return clearScheduledWork
  }, [
    clearScheduledWork,
    params.durationMs,
    params.latencyMs,
    params.lift,
    params.message,
    params.motion,
    params.outcome,
    resetPreview,
  ])

  const completeFlight = useCallback((clientId: string) => {
    setFlight(current => (current?.clientId === clientId ? null : current))
  }, [])

  const measureTarget = useCallback(() => {
    const current = flightRef.current
    if (!current || current.target) {
      return
    }
    const target = readRelativeRect(targetRef.current, rootRef.current)
    if (!target) {
      return
    }
    setFlight(active => (active?.clientId === current.clientId && !active.target ? { ...active, target } : active))
  }, [])

  const scheduleTargetMeasurement = useCallback(() => {
    if (measurementFrameRef.current !== null) {
      cancelAnimationFrame(measurementFrameRef.current)
    }
    measurementFrameRef.current = requestAnimationFrame(() => {
      measurementFrameRef.current = null
      measureTarget()
    })
  }, [measureTarget])

  const handleSend = useCallback(() => {
    const content = draft.trim()
    if (!content || busy) {
      return
    }
    const clientId = createPreviewCommentId()
    const origin = readRelativeRect(inputRef.current, rootRef.current)
    const optimistic: DemoComment = {
      author: 'You',
      content,
      delivery: 'sending',
      id: clientId,
      time: 'now',
    }

    clearScheduledWork()
    targetRef.current = null
    setError(null)
    setDraft('')
    setComments(current => [...current.filter(comment => comment.delivery !== 'sending'), optimistic].slice(-3))
    setFlight(origin ? { clientId, content, origin, target: null } : null)

    deliveryTimerRef.current = setTimeout(
      (id: string, sentContent: string) => {
        deliveryTimerRef.current = null
        if (params.outcome === 'success') {
          setComments(current =>
            current.map(comment => (comment.id === id ? { ...comment, delivery: 'sent' } : comment)))
          return
        }
        completeFlight(id)
        setComments(current => current.filter(comment => comment.id !== id))
        setDraft(sentContent)
        setError('Simulated request failed. The draft was restored.')
        requestAnimationFrame(() => inputRef.current?.focus())
      },
      params.latencyMs,
      clientId,
      content,
    )
  }, [busy, clearScheduledWork, completeFlight, draft, params.latencyMs, params.outcome])

  return (
    <View ref={rootRef} style={styles.preview}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.previewEyebrow}>LIVE COMPONENT</Text>
          <Text style={styles.previewTitle}>Photo comments</Text>
        </View>
        <View style={[styles.statusPill, error ? styles.statusPillError : null]}>
          <View style={[styles.statusDot, error ? styles.statusDotError : busy ? styles.statusDotBusy : null]} />
          <Text style={styles.statusLabel}>{error ? 'Rolled back' : busy ? 'Sending' : 'Ready'}</Text>
        </View>
      </View>

      <View style={styles.commentList}>
        {comments.map((comment) => {
          const flightTarget = flight?.clientId === comment.id
          const own = comment.author === 'You'
          return (
            <View
              key={comment.id}
              style={[
                styles.commentRow,
                own ? styles.commentRowOwn : styles.commentRowIncoming,
                flightTarget && styles.flightTargetHidden,
              ]}
            >
              {own ? null : (
                <View style={styles.avatar}>
                  <Text style={styles.avatarLabel}>{comment.author[0]}</Text>
                </View>
              )}
              <View style={[styles.commentBody, own && styles.commentBodyOwn]}>
                {own ? null : (
                  <View style={styles.commentMeta}>
                    <Text style={styles.commentAuthor}>{comment.author}</Text>
                    <Text style={styles.commentTime}>{comment.time}</Text>
                  </View>
                )}
                <CommentBubbleSurface
                  ref={flightTarget ? targetRef : undefined}
                  own={own}
                  style={[styles.commentBubble, own && styles.commentBubbleOwn]}
                  onLayout={flightTarget ? scheduleTargetMeasurement : undefined}
                >
                  <CommentBubbleText own={own}>{comment.content}</CommentBubbleText>
                </CommentBubbleSurface>
                <View style={[styles.commentFooter, own && styles.commentFooterOwn]}>
                  {own ? <Text style={styles.commentTime}>{comment.time}</Text> : null}
                  {comment.delivery === 'sending' ? (
                    <View style={styles.deliveryState}>
                      <ActivityIndicator color={palette.textMuted} size="small" style={styles.deliverySpinner} />
                      <Text style={styles.deliveryLabel}>Sending…</Text>
                    </View>
                  ) : comment.delivery === 'sent' ? (
                    <SymbolView name="checkmark.circle.fill" size={12} tintColor={palette.accentHi} />
                  ) : null}
                  <View style={styles.commentActions}>
                    <SymbolView name="heart" size={12} tintColor={palette.textMuted} />
                    <Text style={styles.commentActionLabel}>Reply</Text>
                  </View>
                </View>
              </View>
            </View>
          )
        })}
      </View>

      <View style={styles.previewFooter}>
        {error ? (
          <View style={styles.errorBanner}>
            <SymbolView name="exclamationmark.circle.fill" size={14} tintColor={palette.danger} />
            <Text style={styles.errorLabel}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.composerRow}>
          <View style={styles.composerPill}>
            <TextInput
              ref={inputRef}
              accessibilityLabel="Preview comment"
              editable={!busy}
              maxLength={280}
              multiline
              placeholder="Write a comment…"
              placeholderTextColor={palette.textMuted}
              selectionColor={palette.accent}
              style={styles.input}
              value={draft}
              onChangeText={(value) => {
                setDraft(value)
                if (error) {
                  setError(null)
                }
              }}
            />
            <Pressable
              accessibilityLabel="Send preview comment"
              accessibilityRole="button"
              disabled={!draft.trim() || busy}
              style={({ pressed }) => [
                styles.sendButton,
                (!draft.trim() || busy) && styles.sendButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSend}
            >
              {sending ? (
                <ActivityIndicator color={palette.accentContrast} size="small" />
              ) : (
                <SymbolView name="arrow.up" size={15} tintColor={palette.accentContrast} weight="bold" />
              )}
            </Pressable>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}
          onPress={resetPreview}
        >
          <SymbolView name="arrow.counterclockwise" size={12} tintColor={palette.textSecondary} />
          <Text style={styles.resetLabel}>Reset preview</Text>
        </Pressable>
      </View>

      {flight ? (
        <CommentSendFlight
          clientId={flight.clientId}
          content={flight.content}
          durationMs={params.durationMs}
          lift={params.lift}
          origin={flight.origin}
          reduceMotion={reduceMotion}
          target={flight.target}
          onComplete={completeFlight}
        />
      ) : null}
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    preview: {
      backgroundColor: palette.bgSurface,
      borderColor: palette.borderStrong,
      borderCurve: 'continuous',
      borderRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      minHeight: 430,
      overflow: 'hidden',
    },
    previewHeader: {
      alignItems: 'center',
      borderBottomColor: palette.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    previewEyebrow: {
      color: palette.accentHi,
      fontFamily: font.mono,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    previewTitle: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 16, fontWeight: '700', marginTop: 3 },
    statusPill: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 999,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    statusPillError: { backgroundColor: 'rgba(255, 69, 58, 0.12)' },
    statusDot: { backgroundColor: '#30d158', borderRadius: 4, height: 7, width: 7 },
    statusDotBusy: { backgroundColor: '#ff9f0a' },
    statusDotError: { backgroundColor: palette.danger },
    statusLabel: { color: palette.textSecondary, fontFamily: font.mono, fontSize: 10, fontWeight: '600' },
    commentList: { flex: 1, paddingHorizontal: 13, paddingVertical: 8 },
    commentRow: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      gap: 8,
      paddingVertical: 5,
    },
    commentRowIncoming: { paddingRight: 36 },
    commentRowOwn: { justifyContent: 'flex-end', paddingLeft: 42 },
    flightTargetHidden: { opacity: 0 },
    avatar: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      height: 28,
      justifyContent: 'center',
      width: 28,
    },
    avatarLabel: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 11, fontWeight: '700' },
    commentBody: { flex: 1, gap: 4, minWidth: 0 },
    commentBodyOwn: { alignItems: 'flex-end' },
    commentMeta: { alignItems: 'center', flexDirection: 'row', gap: 6, marginLeft: 7 },
    commentAuthor: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 12, fontWeight: '600' },
    commentTime: { color: palette.textMuted, fontFamily: font.ui, fontSize: 10 },
    commentBubble: { alignSelf: 'flex-start', maxWidth: COMMENT_BUBBLE_MAX_WIDTH },
    commentBubbleOwn: { alignSelf: 'flex-end' },
    commentFooter: { alignItems: 'center', flexDirection: 'row', gap: 5, marginLeft: 4, minHeight: 22 },
    commentFooterOwn: { alignSelf: 'flex-end', marginLeft: 0, marginRight: 4 },
    commentActions: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    commentActionLabel: { color: palette.textMuted, fontFamily: font.ui, fontSize: 10 },
    deliveryState: { alignItems: 'center', flexDirection: 'row', gap: 3 },
    deliverySpinner: { height: 11, transform: [{ scale: 0.5 }], width: 11 },
    deliveryLabel: { color: palette.textMuted, fontFamily: font.ui, fontSize: 9 },
    previewFooter: {
      backgroundColor: palette.bgSurface,
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: 8,
      padding: 12,
    },
    composerRow: { flexDirection: 'row' },
    composerPill: {
      alignItems: 'flex-end',
      backgroundColor: palette.bgElement,
      borderColor: palette.borderStrong,
      borderCurve: 'continuous',
      borderRadius: 21,
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
      maxHeight: 82,
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
    sendButtonDisabled: { opacity: 0.36 },
    errorBanner: {
      alignItems: 'center',
      backgroundColor: 'rgba(255, 69, 58, 0.1)',
      borderCurve: 'continuous',
      borderRadius: 9,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 7,
    },
    errorLabel: { color: palette.danger, flex: 1, fontFamily: font.ui, fontSize: 11 },
    resetButton: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 5, paddingVertical: 2 },
    resetLabel: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 10, fontWeight: '600' },
    pressed: { opacity: 0.58 },
  })
}
