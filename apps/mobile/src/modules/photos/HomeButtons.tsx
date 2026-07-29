import { BlurView } from 'expo-blur'
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
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => void present(filterSheetPage)}
      >
        <BlurView intensity={100} style={styles.circle} tint="systemChromeMaterialDark">
          <SymbolView
            name="line.3.horizontal.decrease"
            size={15}
            tintColor={active ? palette.accent : palette.textPrimary}
          />
        </BlurView>
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
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderCurve: 'continuous',
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      height: 36,
      justifyContent: 'center',
      overflow: 'hidden',
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
