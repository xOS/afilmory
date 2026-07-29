import { Image } from 'expo-image'
import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/modules/auth/sessionStore'
import { present } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { useFilters } from './filters/filterStore'
import { countActiveDimensions, hasActiveFilters } from './filters/filterTypes'
import { filterSheetPage } from './filterSheetPage'
import { GlassSurface, supportsLiquidGlass } from './GlassSurface'
import { profileSheetPage } from './profileSheetPage'

const EDGE = 12
const CIRCLE = 36
const GAP = 10

export const HOME_BUTTONS_CLEARANCE = EDGE + CIRCLE + GAP + CIRCLE + EDGE

export function HomeButtons() {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const insets = useSafeAreaInsets()
  const filters = useFilters()
  const active = hasActiveFilters(filters)
  const auth = useAuth()

  return (
    <View style={[styles.container, { top: insets.top + 8 }]}>
      <Pressable
        accessibilityLabel="Profile"
        accessibilityRole="button"
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && !supportsLiquidGlass() && styles.pressed]}
        onPress={() => void present(profileSheetPage)}
      >
        <GlassSurface interactive style={styles.circle}>
          {auth.session?.user.image ? (
            <Image source={{ uri: auth.session.user.image }} style={styles.avatarImage} transition={150} />
          ) : (
            <Text style={styles.avatarInitial}>{(auth.session?.user.name ?? '?').slice(0, 1).toUpperCase()}</Text>
          )}
        </GlassSurface>
      </Pressable>
      <Pressable
        accessibilityLabel="Filters"
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        hitSlop={8}
        style={({ pressed }) => [styles.button, pressed && !supportsLiquidGlass() && styles.pressed]}
        onPress={() => void present(filterSheetPage)}
      >
        <GlassSurface interactive style={styles.circle}>
          <SymbolView
            name="line.3.horizontal.decrease"
            size={15}
            tintColor={active ? palette.accent : palette.textPrimary}
            weight="semibold"
          />
        </GlassSurface>
        {active ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{countActiveDimensions(filters)}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: GAP,
      position: 'absolute',
      right: EDGE,
      zIndex: 10,
    },
    button: { height: CIRCLE, width: CIRCLE },
    circle: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: CIRCLE / 2,
      height: CIRCLE,
      justifyContent: 'center',
      overflow: 'hidden',
      width: CIRCLE,
    },
    avatarImage: {
      height: CIRCLE,
      width: CIRCLE,
    },
    avatarInitial: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 14,
      fontWeight: '700',
    },
    badge: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderRadius: 8,
      height: 16,
      justifyContent: 'center',
      position: 'absolute',
      right: -4,
      top: -4,
      width: 16,
    },
    badgeLabel: {
      color: palette.accentContrast,
      fontFamily: font.ui,
      fontSize: 10,
      fontWeight: '700',
    },
    pressed: { opacity: 0.6 },
  })
}
