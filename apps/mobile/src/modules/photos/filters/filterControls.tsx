import { SymbolView } from 'expo-symbols'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

// Matches the height the compact DateTimePicker renders at, so the custom chips and the
// native date pills in the Date group line up instead of sitting at two different sizes.
const CONTROL_H = 36

export function FilterSection({ children, title }: { children: ReactNode, title: string }) {
  const styles = useControlStyles()

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

export function FilterChip({
  count,
  label,
  onPress,
  selected,
}: {
  count?: number
  label: string
  onPress: () => void
  selected: boolean
}) {
  const styles = useControlStyles()

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text numberOfLines={1} style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
      {count === undefined ? null : (
        <Text style={[styles.chipCount, selected && styles.chipCountSelected]}>{count}</Text>
      )}
    </Pressable>
  )
}

export function FilterOptionRow({
  count,
  label,
  onPress,
  selected,
}: {
  count: number
  label: string
  onPress: () => void
  selected: boolean
}) {
  const { palette } = useTheme()
  const styles = useControlStyles()

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text numberOfLines={1} style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
        {label}
      </Text>
      <Text style={styles.rowCount}>{count}</Text>
      <View style={styles.rowCheck}>
        {selected ? <SymbolView name="checkmark" size={14} tintColor={palette.accent} /> : null}
      </View>
    </Pressable>
  )
}

export function SegmentedControl<T extends string>({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled?: boolean
  onChange: (value: T) => void
  options: { label: string, value: T }[]
  value: T
}) {
  const styles = useControlStyles()

  return (
    <View style={[styles.segment, disabled && styles.segmentDisabled]}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole="button"
            accessibilityState={{ disabled, selected: active }}
            disabled={disabled}
            key={option.value}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function useControlStyles() {
  const { palette } = useTheme()
  return useMemo(() => createControlStyles(palette), [palette])
}

function createControlStyles(palette: Palette) {
  return StyleSheet.create({
    section: { gap: 10 },
    sectionTitle: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 0.2,
      textTransform: 'uppercase',
    },
    chip: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: CONTROL_H / 2,
      flexDirection: 'row',
      gap: 6,
      height: CONTROL_H,
      maxWidth: '100%',
      paddingHorizontal: 14,
    },
    chipSelected: { backgroundColor: palette.accent },
    chipLabel: {
      color: palette.textPrimary,
      flexShrink: 1,
      fontFamily: font.ui,
      fontSize: 17,
      fontWeight: '400',
    },
    chipLabelSelected: { color: palette.accentContrast },
    chipCount: {
      color: palette.textMuted,
      fontFamily: font.ui,
      fontSize: 12,
    },
    chipCountSelected: { color: 'rgba(255, 255, 255, 0.7)' },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      minHeight: 40,
    },
    rowLabel: {
      color: palette.textPrimary,
      flex: 1,
      fontFamily: font.ui,
      fontSize: 15,
    },
    rowLabelSelected: { color: palette.accent, fontWeight: '600' },
    rowCount: {
      color: palette.textMuted,
      fontFamily: font.ui,
      fontSize: 13,
    },
    rowCheck: { alignItems: 'center', width: 18 },
    segment: {
      alignSelf: 'flex-start',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 10,
      flexDirection: 'row',
      height: CONTROL_H,
      padding: 2,
    },
    segmentDisabled: { opacity: 0.4 },
    segmentItem: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 8,
      justifyContent: 'center',
      minWidth: 72,
      paddingHorizontal: 14,
    },
    segmentItemActive: { backgroundColor: palette.bgHover },
    segmentLabel: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 17,
      fontWeight: '400',
    },
    segmentLabelActive: { color: palette.textPrimary, fontWeight: '600' },
    pressed: { opacity: 0.6 },
  })
}
