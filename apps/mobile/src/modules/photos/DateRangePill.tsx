import { BlurView } from 'expo-blur'
import { StyleSheet, Text } from 'react-native'
import Animated, { FadeInUp, FadeOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { font } from '@/theme/tokens'

export function DateRangePill({ label, visible }: { label: string | null, visible: boolean }) {
  const insets = useSafeAreaInsets()

  if (!visible || !label) {
    return null
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOut.duration(150)}
      pointerEvents="none"
      style={[styles.container, { top: insets.top + 8 }]}
    >
      <BlurView intensity={100} style={styles.pill} tint="systemChromeMaterialDark">
        <Text style={styles.label}>{label}</Text>
      </BlurView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    left: 12,
    position: 'absolute',
    zIndex: 10,
  },
  pill: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderCurve: 'continuous',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
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
