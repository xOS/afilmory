import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { ApiEnvironmentSection } from './ApiEnvironmentSection'

export function DevLabScreen() {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.root}
    >
      <View style={styles.environmentBanner}>
        <View style={styles.environmentIcon}>
          <SymbolView name="hammer.fill" size={15} tintColor={palette.accentHi} />
        </View>
        <View style={styles.environmentCopy}>
          <Text style={styles.environmentTitle}>Development environment</Text>
          <Text style={styles.environmentDescription}>Configure and verify the API endpoint used by this build.</Text>
        </View>
        <Text style={styles.environmentBadge}>DEV</Text>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.eyebrow}>API ENVIRONMENT</Text>
        <Text style={styles.title}>Backend target</Text>
        <Text style={styles.subtitle}>Select the local stack or the production service, then reload the app.</Text>
      </View>

      <ApiEnvironmentSection />
    </ScrollView>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    content: {
      gap: 22,
      paddingBottom: 48,
      paddingHorizontal: 18,
      paddingTop: 18,
    },
    environmentBadge: {
      color: palette.accentHi,
      fontFamily: font.ui,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    environmentBanner: {
      alignItems: 'center',
      borderColor: palette.border,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 12,
      padding: 14,
    },
    environmentCopy: { flex: 1, gap: 2 },
    environmentDescription: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 12,
      lineHeight: 17,
    },
    environmentIcon: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderRadius: 10,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    environmentTitle: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 14,
      fontWeight: '700',
    },
    eyebrow: {
      color: palette.accentHi,
      fontFamily: font.ui,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    root: { backgroundColor: palette.bgCanvas, flex: 1 },
    sectionHeading: { gap: 5 },
    subtitle: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 13,
      lineHeight: 18,
    },
    title: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.4,
    },
  })
}
