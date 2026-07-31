import { Image } from 'expo-image'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import githubMark from '@/assets/images/github-mark.svg'
import googleG from '@/assets/images/google-g.png'
import { useTranslation } from '@/i18n'
import type { Palette } from '@/theme/palette'
import { controlH, font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { signInWithProvider } from './sessionStore'
import type { AuthProviderId } from './types'

const PROVIDERS: Array<{ id: AuthProviderId, labelKey: string, logo: number, tinted: boolean }> = [
  { id: 'github', labelKey: 'auth.continue.github', logo: githubMark, tinted: true },
  { id: 'google', labelKey: 'auth.continue.google', logo: googleG, tinted: false },
]

const USER_CANCELLED_PATTERN = /cancel|dismiss/i

export function SignInSection({ compact = false, onSignedIn }: { compact?: boolean, onSignedIn?: () => void }) {
  const { palette } = useTheme()
  const { t } = useTranslation()
  const styles = useMemo(() => createStyles(palette), [palette])
  const [busyProvider, setBusyProvider] = useState<AuthProviderId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSignIn = async (provider: AuthProviderId) => {
    if (busyProvider) {
      return
    }
    setBusyProvider(provider)
    setError(null)
    try {
      await signInWithProvider(provider)
      onSignedIn?.()
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!USER_CANCELLED_PATTERN.test(message)) {
        setError(t('auth.failed'))
      }
    }
    finally {
      setBusyProvider(null)
    }
  }

  return (
    <View style={styles.root}>
      <View style={compact ? styles.providerRow : styles.providerStack}>
        {PROVIDERS.map((provider) => {
          const label = t(provider.labelKey)
          return (
            <Pressable
              key={provider.id}
              accessibilityLabel={label}
              accessibilityRole="button"
              disabled={busyProvider !== null}
              style={({ pressed }) => [
                styles.providerButton,
                compact && styles.providerButtonCompact,
                busyProvider !== null && busyProvider !== provider.id && styles.providerButtonDisabled,
                pressed && styles.pressed,
              ]}
              onPress={() => void handleSignIn(provider.id)}
            >
              {busyProvider === provider.id ? (
                <ActivityIndicator color={palette.textPrimary} />
              ) : (
                <View style={styles.providerContent}>
                  <Image
                    source={provider.logo}
                    style={styles.providerLogo}
                    tintColor={provider.tinted ? palette.textPrimary : undefined}
                  />
                  <Text numberOfLines={1} style={styles.providerLabel}>
                    {label}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
      {error || !compact ? (
        <View style={[styles.errorSlot, compact && styles.errorSlotCompact]}>
          {error ? (
            <Text numberOfLines={3} style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { gap: 10 },
    providerStack: { gap: 10 },
    providerRow: { flexDirection: 'row', gap: 8 },
    providerButton: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      height: controlH,
      justifyContent: 'center',
    },
    providerButtonCompact: { flex: 1, paddingHorizontal: 10 },
    providerButtonDisabled: { opacity: 0.45 },
    providerContent: {
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 1,
      gap: 10,
    },
    providerLogo: {
      height: 18,
      width: 18,
    },
    providerLabel: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 15,
      flexShrink: 1,
      fontWeight: '600',
    },
    errorSlot: {
      justifyContent: 'center',
      minHeight: 44,
    },
    errorSlotCompact: { minHeight: 0 },
    error: {
      color: palette.danger,
      fontFamily: font.ui,
      fontSize: 13,
      textAlign: 'center',
    },
    pressed: { opacity: 0.7 },
  })
}
