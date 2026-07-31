import { useEffect, useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useTranslation } from '@/i18n'
import { useAuth } from '@/modules/auth/sessionStore'
import { signInPage } from '@/modules/auth/signInPage'
import { present } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { clearFilters } from './filters/filterStore'
import { clearHomeFeed } from './homeFeedStore'
import { OwnGalleryView } from './OwnGalleryView'

export function PhotosHomeScreen() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const auth = useAuth()
  const signedOut = auth.status === 'signedOut'

  useEffect(() => {
    if (signedOut) {
      clearFilters()
      clearHomeFeed()
    }
  }, [signedOut])

  if (auth.status === 'loading') {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={palette.textSecondary} />
      </View>
    )
  }

  if (auth.status === 'signedOut') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.heroTitle}>{t('gallery.yours.title')}</Text>
        <Text style={styles.heroSubtitle}>{t('gallery.yours.subtitle')}</Text>
        <Pressable
          accessibilityLabel={t('accessibility.goToSignIn')}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.heroButton, pressed && styles.pressed]}
          onPress={() => void present(signInPage)}
        >
          <Text style={styles.heroButtonLabel}>{t('common.signIn')}</Text>
        </Pressable>
      </View>
    )
  }

  const workspace = auth.session?.activeWorkspace
  if (!workspace || workspace.status !== 'active') {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.heroTitle}>{t('gallery.workspace.pending.title')}</Text>
        <Text style={styles.heroSubtitle}>{t('gallery.workspace.pending.subtitle')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <OwnGalleryView slug={workspace.slug} />
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: palette.bgCanvas },
    center: {
      alignItems: 'center',
      gap: 10,
      justifyContent: 'center',
      paddingHorizontal: 36,
    },
    heroTitle: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    heroSubtitle: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    heroButton: {
      backgroundColor: palette.accent,
      borderCurve: 'continuous',
      borderRadius: radiusLg,
      marginTop: 10,
      paddingHorizontal: 28,
      paddingVertical: 12,
    },
    heroButtonLabel: {
      color: palette.accentContrast,
      fontFamily: font.ui,
      fontSize: 16,
      fontWeight: '600',
    },
    pressed: { opacity: 0.75 },
  })
}
