import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { font } from '@/theme/tokens'

import { GlassSurface, supportsLiquidGlass } from './GlassSurface'
import { HOME_BUTTONS_CLEARANCE } from './HomeButtons'

export function DateRangePill({
  label,
  onPress,
  visible,
}: {
  label: string | null
  onPress?: () => void
  visible: boolean
}) {
  const insets = useSafeAreaInsets()

  if (!visible || !label) {
    return null
  }

  const pill = (
    <GlassSurface interactive={onPress !== undefined} style={styles.pill}>
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
    </GlassSurface>
  )

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOut.duration(150)}
      pointerEvents={onPress ? 'box-none' : 'none'}
      style={[styles.container, { top: insets.top + 8 }]}
    >
      {onPress ? (
        <Pressable
          accessibilityLabel={label}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.pressable, pressed && !supportsLiquidGlass() && styles.pressed]}
          onPress={onPress}
        >
          {pill}
        </Pressable>
      ) : (
        pill
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    left: 12,
    position: 'absolute',
    right: HOME_BUTTONS_CLEARANCE,
    zIndex: 10,
  },
  pressable: { maxWidth: '100%' },
  pressed: { opacity: 0.6 },
  pill: {
    borderCurve: 'continuous',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {
    color: '#f5f5f7',
    fontFamily: font.ui,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
})
