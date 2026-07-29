import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet } from 'react-native'

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
      <GlassView colorScheme="dark" glassEffectStyle="regular" isInteractive={interactive} style={style}>
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
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
})
