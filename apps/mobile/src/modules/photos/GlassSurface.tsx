import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet } from 'react-native'

// Glass adapts to whatever photo sits behind it, but our overlay labels and icons are a fixed
// near-white, so an untinted surface disappears over bright frames. The tint pins the surface
// dark enough that white content always reads, on both the glass and the blur path.
const legibilityTint = 'rgba(0, 0, 0, 0.42)'

export function supportsLiquidGlass(): boolean {
  return isLiquidGlassAvailable()
}

export function GlassSurface({
  children,
  interactive,
  style,
}: {
  children: ReactNode
  interactive?: boolean
  style?: StyleProp<ViewStyle>
}) {
  if (supportsLiquidGlass()) {
    return (
      <GlassView
        colorScheme="dark"
        glassEffectStyle="regular"
        isInteractive={interactive}
        style={style}
        tintColor={legibilityTint}
      >
        {children}
      </GlassView>
    )
  }

  return (
    <BlurView intensity={100} style={[styles.fallback, style]} tint="systemChromeMaterialDark">
      {children}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: legibilityTint,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
})
