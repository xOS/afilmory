import type { ReactNode } from 'react'
import { forwardRef } from 'react'
import type { LayoutChangeEvent, StyleProp, TextProps, ViewStyle } from 'react-native'
import { StyleSheet, Text, View } from 'react-native'

import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

export const COMMENT_BUBBLE_MAX_WIDTH = '82%' as const

const styleCache = new WeakMap<Palette, ReturnType<typeof createStyles>>()

function useBubbleStyles() {
  const { palette } = useTheme()
  const cached = styleCache.get(palette)
  if (cached) {
    return cached
  }
  const styles = createStyles(palette)
  styleCache.set(palette, styles)
  return styles
}

export const CommentBubbleSurface = forwardRef<
  View,
  {
    children: ReactNode
    onLayout?: (event: LayoutChangeEvent) => void
    own: boolean
    style?: StyleProp<ViewStyle>
  }
>(({ children, onLayout, own, style }, ref) => {
  const styles = useBubbleStyles()

  return (
    <View
      ref={ref}
      style={[styles.surface, own ? styles.ownSurface : styles.incomingSurface, style]}
      onLayout={onLayout}
    >
      {children}
    </View>
  )
})
CommentBubbleSurface.displayName = 'CommentBubbleSurface'

export function CommentBubbleText({ children, own, style, ...props }: TextProps & { own: boolean }) {
  const styles = useBubbleStyles()

  return (
    <Text {...props} style={[styles.text, own ? styles.ownText : styles.incomingText, style]}>
      {children}
    </Text>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    surface: {
      borderCurve: 'continuous',
      borderRadius: 20,
      justifyContent: 'center',
      minHeight: 38,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    ownSurface: {
      backgroundColor: palette.accent,
      borderBottomRightRadius: 6,
    },
    incomingSurface: {
      backgroundColor: palette.bgElement,
      borderBottomLeftRadius: 6,
      borderColor: palette.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    text: {
      fontFamily: font.ui,
      fontSize: 14,
      lineHeight: 19,
    },
    ownText: { color: palette.accentContrast },
    incomingText: { color: palette.textPrimary },
  })
}
