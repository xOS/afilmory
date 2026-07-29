import { SymbolView } from 'expo-symbols'
import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

export function AppHeader() {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])

  return (
    <SafeAreaView edges={['top']} style={styles.safeAreaSurface}>
      <View style={styles.bar}>
        <View style={styles.identity}>
          <View style={styles.brandMark}>
            <SymbolView name="camera.aperture" size={13} tintColor={palette.accent} />
          </View>
          <Text style={styles.brand}>Afilmory</Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    safeAreaSurface: {
      backgroundColor: palette.bgCanvas,
      borderBottomColor: palette.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    bar: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 50,
      paddingBottom: 7,
      paddingHorizontal: 16,
      paddingTop: 5,
    },
    identity: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    brandMark: {
      alignItems: 'center',
      backgroundColor: palette.accentDim,
      borderCurve: 'continuous',
      borderRadius: 8,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    brand: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: -0.25,
    },
  })
}
