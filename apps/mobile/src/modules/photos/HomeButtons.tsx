import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { present } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { useFilters } from './filters/filterStore'
import { countActiveDimensions, hasActiveFilters } from './filters/filterTypes'
import { filterSheetPage } from './filterSheetPage'
import { GlassSurface, supportsLiquidGlass } from './GlassSurface'

export function HomeButtons() {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const insets = useSafeAreaInsets()
  const filters = useFilters()
  const active = hasActiveFilters(filters)

  return (
    <View style={[styles.container, { top: insets.top + 8 }]}>
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
      alignItems: 'flex-end',
      gap: 8,
      position: 'absolute',
      right: 12,
      zIndex: 10,
    },
    button: { height: 36, width: 36 },
    circle: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 18,
      height: 36,
      justifyContent: 'center',
      width: 36,
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
