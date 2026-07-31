import { useEffect } from 'react'
import type { TextInput } from 'react-native'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { CommentBubbleSurface, CommentBubbleText } from './CommentBubble'

export const COMMENT_FLIGHT_DEFAULT_DURATION_MS = 360
export const COMMENT_FLIGHT_DEFAULT_LIFT = 8

export interface CommentFlightRect {
  height: number
  width: number
  x: number
  y: number
}

export function readRelativeRect(node: TextInput | View | null, root: View | null): CommentFlightRect | null {
  if (!node || !root) {
    return null
  }
  const nodeRect = node.getBoundingClientRect()
  const rootRect = root.getBoundingClientRect()
  if (!Number.isFinite(nodeRect.x) || !Number.isFinite(nodeRect.y) || nodeRect.width <= 0 || nodeRect.height <= 0) {
    return null
  }
  return {
    height: nodeRect.height,
    width: nodeRect.width,
    x: nodeRect.x - rootRect.x,
    y: nodeRect.y - rootRect.y,
  }
}

export function CommentSendFlight({
  durationMs = COMMENT_FLIGHT_DEFAULT_DURATION_MS,
  clientId,
  content,
  lift = COMMENT_FLIGHT_DEFAULT_LIFT,
  onComplete,
  origin,
  reduceMotion,
  target,
}: {
  durationMs?: number
  clientId: string
  content: string
  lift?: number
  onComplete: (clientId: string) => void
  origin: CommentFlightRect
  reduceMotion?: boolean
  target: CommentFlightRect | null
}) {
  const systemReducedMotion = useReducedMotion()
  const reducedMotion = reduceMotion ?? systemReducedMotion
  const safeDurationMs = Math.max(0, Math.min(durationMs, 1600))
  const safeLift = Math.max(0, Math.min(lift, 48))
  const progress = useSharedValue(0)
  const startX = target ? Math.max(0, origin.x + origin.width - target.width) : origin.x
  const startY = target ? origin.y + (origin.height - target.height) / 2 : origin.y
  const targetX = target ? target.x - startX : 0
  const targetY = target ? target.y - startY : 0

  useEffect(() => {
    progress.set(0)
  }, [clientId, progress])

  useEffect(() => {
    if (!target) {
      return
    }
    const duration = reducedMotion ? 0 : safeDurationMs
    progress.set(
      withTiming(
        1,
        {
          duration,
          easing: Easing.bezier(0.2, 0.78, 0.2, 1),
          reduceMotion: reducedMotion ? ReduceMotion.Always : ReduceMotion.Never,
        },
        (finished) => {
          'worklet'
          if (finished) {
            runOnJS(onComplete)(clientId)
          }
        },
      ),
    )
    return () => {
      cancelAnimation(progress)
    }
  }, [clientId, onComplete, progress, reducedMotion, safeDurationMs, target])

  const animatedStyle = useAnimatedStyle(() => {
    const value = progress.get()
    const arc = -4 * safeLift * value * (1 - value)
    return {
      opacity: interpolate(value, [0, 0.08, 1], [0.88, 1, 1]),
      transform: [
        { translateX: interpolate(value, [0, 1], [0, targetX]) },
        { translateY: targetY * value + arc },
        { scale: interpolate(value, [0, 0.5, 1], [0.96, 1.01, 1]) },
      ],
    }
  })

  if (!target) {
    return null
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.layer}
    >
      <Animated.View
        style={[
          styles.flight,
          {
            height: target.height,
            left: startX,
            top: startY,
            width: target.width,
          },
          animatedStyle,
        ]}
      >
        <CommentBubbleSurface own style={styles.bubble}>
          <CommentBubbleText numberOfLines={5} own>
            {content}
          </CommentBubbleText>
        </CommentBubbleSurface>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  layer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 40,
  },
  flight: {
    position: 'absolute',
    shadowColor: '#007bff',
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  bubble: { flex: 1 },
})
