import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import appIcon from '@/assets/images/icon.png'
import { useTranslation } from '@/i18n'
import { usePageRuntime } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { ShowcaseMasonry } from './ShowcaseMasonry'
import { SignInSection } from './SignInSection'
import { useShowcasePhotos } from './useShowcasePhotos'

const FADE_HEIGHT = 96

export function SignInScreen() {
  const { finish } = usePageRuntime()
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const photos = useShowcasePhotos()
  const [showcaseSize, setShowcaseSize] = useState({ height: 0, width: 0 })

  return (
    <View style={styles.root}>
      <View
        style={styles.showcase}
        onLayout={({ nativeEvent }) =>
          setShowcaseSize({ height: nativeEvent.layout.height, width: nativeEvent.layout.width })}
      >
        <ShowcaseMasonry height={showcaseSize.height} photos={photos} width={showcaseSize.width} />
        <LinearGradient colors={['transparent', palette.bgCanvas]} pointerEvents="none" style={styles.fade} />
      </View>
      <View style={styles.bottom}>
        <Image source={appIcon} style={styles.appIcon} />
        <Text style={styles.title}>Afilmory</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
        <SignInSection onSignedIn={() => finish()} />
      </View>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { backgroundColor: palette.bgCanvas, flex: 1 },
    showcase: { flex: 1 },
    fade: {
      bottom: 0,
      height: FADE_HEIGHT,
      left: 0,
      position: 'absolute',
      right: 0,
    },
    bottom: {
      paddingBottom: 28,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    appIcon: {
      borderCurve: 'continuous',
      borderRadius: 8,
      height: 36,
      marginBottom: 12,
      width: 36,
    },
    title: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.35,
    },
    subtitle: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
      marginTop: 4,
    },
  })
}
