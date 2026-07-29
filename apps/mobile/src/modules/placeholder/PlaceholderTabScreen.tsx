import type { SymbolViewProps } from 'expo-symbols'
import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { AppHeader } from '@/modules/shell/AppHeader'
import type { Palette } from '@/theme/palette'
import { font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

interface PlaceholderTabScreenProps {
  description: string
  icon: SymbolViewProps['name']
  title: string
}

export function PlaceholderTabScreen({ description, icon, title }: PlaceholderTabScreenProps) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])

  return (
    <View style={styles.root}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        style={styles.root}
      >
        <View style={styles.hero}>
          <View style={styles.iconShell}>
            <SymbolView name={icon} size={32} tintColor={palette.accent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Coming soon</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bgCanvas },
    content: {
      alignItems: 'center',
      flexGrow: 1,
      justifyContent: 'center',
      paddingBottom: 120,
      paddingHorizontal: 32,
    },
    hero: { alignItems: 'center', maxWidth: 340 },
    iconShell: {
      alignItems: 'center',
      backgroundColor: palette.accentDim,
      borderColor: palette.accentLine,
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      height: 72,
      justifyContent: 'center',
      marginBottom: 22,
      width: 72,
    },
    title: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 21,
      fontWeight: '700',
      letterSpacing: -0.35,
      textAlign: 'center',
    },
    description: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 9,
      textAlign: 'center',
    },
    statusPill: {
      alignItems: 'center',
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 7,
      marginTop: 22,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    statusDot: {
      backgroundColor: palette.accent,
      borderRadius: 3,
      height: 6,
      width: 6,
    },
    statusText: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 12,
      fontWeight: '600',
    },
  })
}
