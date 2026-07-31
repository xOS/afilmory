import { GlassContainer, GlassView } from 'expo-glass-effect'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { useTranslation } from '@/i18n'
import { font } from '@/theme/tokens'

import { addPhotoReaction, fetchPhotoReactionCounts } from './photoReactionApi'
import type { PhotoReaction, PhotoReactionState } from './photoReactionState'
import {
  createPhotoReactionState,
  mergePhotoReactionCounts,
  PHOTO_REACTIONS,
  rollbackLocalPhotoReaction,
  toggleLocalPhotoReaction,
} from './photoReactionState'

interface PhotoReactionRailProps {
  gallerySlug: string
  nativeGlassAvailable: boolean
  onReactionSelected: () => void
  photoId: string
  visible: boolean
}

const REVEAL_DURATION = 180
const REVEAL_EASING = Easing.bezier(0.32, 0.72, 0, 1)

export function PhotoReactionRail({
  gallerySlug,
  nativeGlassAvailable,
  onReactionSelected,
  photoId,
  visible,
}: PhotoReactionRailProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<PhotoReactionState>(createPhotoReactionState)
  const [pendingReactions, setPendingReactions] = useState<ReadonlySet<PhotoReaction>>(() => new Set())
  const stateRef = useRef(state)
  const pendingRef = useRef(new Set<PhotoReaction>())
  const revealProgress = useSharedValue(visible ? 1 : 0)
  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealProgress.get(),
    transform: [{ translateY: -8 * (1 - revealProgress.get()) }, { scale: 0.96 + 0.04 * revealProgress.get() }],
  }))

  const commitState = useCallback((update: (current: PhotoReactionState) => PhotoReactionState) => {
    const next = update(stateRef.current)
    stateRef.current = next
    setState(next)
  }, [])

  const commitPending = useCallback(() => {
    setPendingReactions(new Set(pendingRef.current))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetchPhotoReactionCounts(gallerySlug, photoId, controller.signal)
      .then((counts) => {
        if (!controller.signal.aborted) {
          commitState(current => mergePhotoReactionCounts(current, counts))
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load photo reactions', error)
        }
      })
    return () => controller.abort()
  }, [commitState, gallerySlug, photoId])

  useEffect(() => {
    revealProgress.set(
      withTiming(visible ? 1 : 0, {
        duration: REVEAL_DURATION,
        easing: REVEAL_EASING,
        reduceMotion: ReduceMotion.System,
      }),
    )
  }, [revealProgress, visible])

  const handleReaction = useCallback(
    (reaction: PhotoReaction) => {
      if (pendingRef.current.has(reaction)) {
        return
      }

      const wasActive = stateRef.current.activeReactions.includes(reaction)
      commitState(current => toggleLocalPhotoReaction(current, reaction))
      onReactionSelected()
      if (wasActive) {
        return
      }

      pendingRef.current.add(reaction)
      commitPending()
      void addPhotoReaction(gallerySlug, photoId, reaction)
        .then(() => AccessibilityInfo.announceForAccessibility(t('photo.reaction.success')))
        .catch((error) => {
          console.error('Failed to add photo reaction', error)
          commitState(current => rollbackLocalPhotoReaction(current, reaction))
          Alert.alert(t('photo.reaction.failed'))
          AccessibilityInfo.announceForAccessibility(t('photo.reaction.failed'))
        })
        .finally(() => {
          pendingRef.current.delete(reaction)
          commitPending()
        })
    },
    [commitPending, commitState, gallerySlug, onReactionSelected, photoId, t],
  )

  const items = PHOTO_REACTIONS.map((reaction) => {
    const count = state.counts[reaction] ?? 0
    const active = state.activeReactions.includes(reaction)
    const pending = pendingReactions.has(reaction)
    const button = (
      <Pressable
        accessibilityLabel={t('photo.reaction.add', { reaction })}
        accessibilityRole="button"
        accessibilityState={{ busy: pending, selected: active }}
        disabled={pending}
        hitSlop={4}
        style={({ pressed }) => [
          styles.reactionButton,
          active && styles.reactionButtonActive,
          pressed && styles.reactionButtonPressed,
          pending && styles.reactionButtonPending,
        ]}
        onPress={() => handleReaction(reaction)}
      >
        <Text style={styles.emoji}>{reaction}</Text>
        {count > 0 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countLabel}>{count > 999 ? '999+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
    )

    if (nativeGlassAvailable) {
      return (
        <GlassView
          key={reaction}
          colorScheme="dark"
          glassEffectStyle="regular"
          isInteractive
          style={styles.reactionSurface}
        >
          {button}
        </GlassView>
      )
    }

    return (
      <View key={reaction} style={[styles.reactionSurface, styles.reactionSurfaceFallback]}>
        {button}
      </View>
    )
  })

  if (nativeGlassAvailable) {
    return (
      <Animated.View
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
        pointerEvents={visible ? 'auto' : 'none'}
        style={[styles.revealContainer, revealStyle]}
      >
        <GlassContainer spacing={6} style={styles.rail}>
          {items}
        </GlassContainer>
      </Animated.View>
    )
  }

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.revealContainer, revealStyle]}
    >
      <View style={styles.rail}>{items}</View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  revealContainer: {
    alignSelf: 'flex-end',
    marginRight: 12,
    marginTop: 8,
  },
  rail: {
    flexDirection: 'row',
    gap: 6,
  },
  reactionSurface: {
    borderCurve: 'continuous',
    borderRadius: 16,
    height: 40,
    width: 40,
  },
  reactionSurfaceFallback: {
    backgroundColor: 'rgba(20,20,22,0.72)',
    borderColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
  },
  reactionButtonActive: {
    backgroundColor: 'rgba(10,132,255,0.24)',
    borderColor: 'rgba(90,180,255,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
  },
  reactionButtonPressed: { opacity: 0.62 },
  reactionButtonPending: { opacity: 0.72 },
  emoji: { fontSize: 21, lineHeight: 27 },
  countBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 15,
    minWidth: 15,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -5,
    top: -5,
  },
  countLabel: {
    color: '#fff',
    fontFamily: font.mono,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },
})
