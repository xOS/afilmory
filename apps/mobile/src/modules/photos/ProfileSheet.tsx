import { Image } from 'expo-image'
import * as Linking from 'expo-linking'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { SAAS_BASE_DOMAIN } from '@/api/client'
import { useTranslation } from '@/i18n'
import { signOut, useAuth } from '@/modules/auth/sessionStore'
import { usePageRuntime } from '@/presentation'
import type { Palette } from '@/theme/palette'
import { controlH, font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { useHomeFeed } from './homeFeedStore'

export function ProfileSheet() {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const auth = useAuth()
  const { photos } = useHomeFeed()
  const runtime = usePageRuntime()
  const [signingOut, setSigningOut] = useState(false)

  const session = auth.session
  const tenant = session?.tenant ?? null

  useEffect(() => {
    if (!session || !tenant) {
      runtime.cancel()
    }
  }, [runtime, session, tenant])

  if (!session || !tenant) {
    return null
  }

  const handleOpenOnWeb = () => {
    void Linking.openURL(`https://${tenant.slug}.${SAAS_BASE_DOMAIN}`)
  }

  const handleSignOut = async () => {
    if (signingOut) {
      return
    }
    setSigningOut(true)
    try {
      await signOut()
      runtime.finish()
    }
    finally {
      setSigningOut(false)
    }
  }

  return (
    <View style={styles.root}>
      {session.user.image ? (
        <Image source={{ uri: session.user.image }} style={styles.avatar} transition={150} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitial}>{session.user.name.slice(0, 1).toUpperCase()}</Text>
        </View>
      )}
      <Text numberOfLines={1} style={styles.name}>
        {session.user.name}
      </Text>
      <Text numberOfLines={1} style={styles.tenantLine}>
        {`${tenant.name} · ${tenant.slug}`}
      </Text>
      <Text style={styles.photoCount}>{t('gallery.photos', { count: photos.length })}</Text>

      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={t('common.openGalleryWeb')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={handleOpenOnWeb}
        >
          <Text style={styles.rowLabel}>{t('common.openGalleryWeb')}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t('common.signOut')}
          accessibilityRole="button"
          disabled={signingOut}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={() => void handleSignOut()}
        >
          {signingOut ? (
            <ActivityIndicator color={palette.danger} />
          ) : (
            <Text style={[styles.rowLabel, styles.dangerLabel]}>{t('common.signOut')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 28,
    },
    avatar: {
      borderRadius: 32,
      height: 64,
      width: 64,
    },
    avatarFallback: {
      alignItems: 'center',
      backgroundColor: palette.accentDim,
      justifyContent: 'center',
    },
    avatarInitial: {
      color: palette.accent,
      fontFamily: font.ui,
      fontSize: 24,
      fontWeight: '700',
    },
    name: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 17,
      fontWeight: '600',
      marginTop: 12,
      maxWidth: '100%',
    },
    tenantLine: {
      color: palette.textSecondary,
      fontFamily: font.ui,
      fontSize: 13,
      marginTop: 4,
      maxWidth: '100%',
    },
    photoCount: {
      color: palette.textMuted,
      fontFamily: font.ui,
      fontSize: 13,
      marginTop: 2,
    },
    actions: {
      gap: 10,
      marginTop: 24,
      width: '100%',
    },
    row: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      height: controlH,
      justifyContent: 'center',
    },
    rowLabel: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 15,
      fontWeight: '600',
    },
    dangerLabel: { color: palette.danger },
    pressed: { opacity: 0.7 },
  })
}
