import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { font } from '@/theme/tokens'

import { GlassSurface, supportsLiquidGlass } from './GlassSurface'
import { HOME_BUTTONS_CLEARANCE, HOME_CHROME_CONTROL, HOME_CHROME_TOP } from './HomeButtons'

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
  const shown = visible && label !== null

  // GlassView latches its effect on the first layout pass, so an entering animation would
  // configure the glass before the pill has its real size and leave it permanently blank.
  // Mounting stays tied to the label and only opacity animates.
  const fade = useAnimatedStyle(() => ({
    opacity: withTiming(shown ? 1 : 0, { duration: shown ? 200 : 150 }),
    transform: [{ translateY: withTiming(shown ? 0 : -6, { duration: shown ? 200 : 150 }) }],
  }))

  if (!label) {
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
      pointerEvents={onPress && shown ? 'box-none' : 'none'}
      style={[styles.container, { top: insets.top + HOME_CHROME_TOP }, fade]}
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
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: HOME_CHROME_CONTROL / 2,
    flexDirection: 'row',
    height: HOME_CHROME_CONTROL,
    paddingHorizontal: 14,
  },
  label: {
    color: '#f5f5f7',
    fontFamily: font.ui,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowRadius: 3,
  },
})
