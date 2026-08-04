import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { CommentsLabOutcome } from '@/native/commentsLab'
import { presentCommentsLab } from '@/native/commentsLab'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

const SCENARIOS: {
  description: string
  icon: string
  label: string
  outcome: CommentsLabOutcome
}[] = [
  {
    description: 'Optimistic bubble flies from the composer and settles in the list.',
    icon: 'paperplane.fill',
    label: 'Send flight · success',
    outcome: 'success',
  },
  {
    description: 'Request fails after the flight; the bubble rolls back and the draft is restored.',
    icon: 'exclamationmark.arrow.circlepath',
    label: 'Send flight · failure',
    outcome: 'failure',
  },
]

export function CommentsLabSection() {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])

  return (
    <View style={styles.card}>
      {SCENARIOS.map((scenario, index) => (
        <Pressable
          accessibilityRole="button"
          key={scenario.outcome}
          style={({ pressed }) => [styles.row, index > 0 && styles.rowDivider, pressed && styles.pressed]}
          onPress={() => void presentCommentsLab(scenario.outcome)}
        >
          <View style={styles.rowIcon}>
            <SymbolView name={scenario.icon as never} size={14} tintColor={palette.accentHi} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>{scenario.label}</Text>
            <Text style={styles.rowDescription}>{scenario.description}</Text>
          </View>
          <SymbolView name="chevron.right" size={11} tintColor={palette.textMuted} />
        </Pressable>
      ))}
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    rowDivider: {
      borderTopColor: palette.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    rowIcon: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderRadius: 10,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    rowCopy: { flex: 1, gap: 2 },
    rowLabel: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 14,
      fontWeight: '600',
    },
    rowDescription: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 12,
      lineHeight: 17,
    },
    pressed: { opacity: 0.58 },
  })
}
