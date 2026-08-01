import { useMemo, useState } from 'react'
import { DevSettings, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { ApiEnvironment } from '@/api/environment'
import {
  buildPlatformOrigin,
  buildTenantOrigin,
  BUILT_IN_ENVIRONMENTS,
  getActiveEnvironment,
  persistEnvironment,
} from '@/api/environment'
import { signInWithPassword, useAuth } from '@/modules/auth/sessionStore'
import type { Palette } from '@/theme/palette'
import { font } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

type ProbeState = { kind: 'idle' } | { kind: 'probing' } | { kind: 'done', label: string, ok: boolean }

const PROBE_TIMEOUT_MS = 4000

function customFrom(environment: ApiEnvironment): ApiEnvironment {
  return { ...environment, id: 'custom', label: 'Custom' }
}

async function probePlatform(environment: ApiEnvironment): Promise<{ label: string, ok: boolean }> {
  const url = `${buildPlatformOrigin(environment)}/api/auth/session`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return { label: `HTTP ${res.status}`, ok: res.status < 500 }
  }
  catch (error) {
    return { label: error instanceof Error ? error.message : 'unreachable', ok: false }
  }
  finally {
    clearTimeout(timer)
  }
}

export function ApiEnvironmentSection() {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const active = getActiveEnvironment()
  const [draft, setDraft] = useState<ApiEnvironment>(active)
  const [probe, setProbe] = useState<ProbeState>({ kind: 'idle' })
  const auth = useAuth()
  const [email, setEmail] = useState('root@local.host')
  const [password, setPassword] = useState('')
  const [signInNote, setSignInNote] = useState<string | null>(null)

  const isDirty
    = draft.scheme !== active.scheme
      || draft.platformHost !== active.platformHost
      || draft.baseDomain !== active.baseDomain
      || draft.port !== active.port

  const runProbe = async () => {
    setProbe({ kind: 'probing' })
    const result = await probePlatform(draft)
    setProbe({ kind: 'done', label: result.label, ok: result.ok })
  }

  // The reload is what drops the previous environment's session cookie and
  // cached queries — switching hosts invalidates both.
  const applyAndReload = () => {
    void persistEnvironment(draft).then(() => {
      DevSettings.reload()
    })
  }

  return (
    <View style={styles.card}>
      <View style={styles.presetRow}>
        {[...BUILT_IN_ENVIRONMENTS, customFrom(active)].map((option) => {
          const selected = draft.id === option.id
          return (
            <Pressable
              accessibilityRole="button"
              key={option.id}
              onPress={() => {
                setDraft(option.id === 'custom' ? customFrom(draft) : option)
                setProbe({ kind: 'idle' })
              }}
              style={[styles.preset, selected && styles.presetSelected]}
            >
              <Text style={[styles.presetLabel, selected && styles.presetLabelSelected]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>

      {draft.id === 'custom' ? (
        <View style={styles.fields}>
          <Field
            label="Platform host"
            onChangeText={value => setDraft(current => ({ ...current, platformHost: value.trim() }))}
            placeholder="localhost:1841"
            styles={styles}
            value={draft.platformHost}
          />
          <Field
            label="Tenant base domain"
            onChangeText={value => setDraft(current => ({ ...current, baseDomain: value.trim() }))}
            placeholder="localhost"
            styles={styles}
            value={draft.baseDomain}
          />
          <Field
            label="Tenant port"
            onChangeText={(value) => {
              const parsed = Number.parseInt(value, 10)
              setDraft(current => ({ ...current, port: Number.isInteger(parsed) ? parsed : null }))
            }}
            placeholder="1841"
            styles={styles}
            value={draft.port === null ? '' : String(draft.port)}
          />
          <Field
            label="Scheme"
            onChangeText={value =>
              setDraft(current => ({ ...current, scheme: value === 'https' ? 'https' : 'http' }))}
            placeholder="http"
            styles={styles}
            value={draft.scheme}
          />
        </View>
      ) : null}

      <View style={styles.previewBlock}>
        <Text style={styles.previewLabel}>PLATFORM</Text>
        <Text style={styles.previewValue}>{`${buildPlatformOrigin(draft)}/api`}</Text>
        <Text style={styles.previewLabel}>TENANT</Text>
        <Text style={styles.previewValue}>{`${buildTenantOrigin(draft, 'example')}/api`}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable accessibilityRole="button" onPress={runProbe} style={styles.secondaryAction}>
          <Text style={styles.secondaryActionLabel}>{probe.kind === 'probing' ? 'Probing…' : 'Probe'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!isDirty}
          onPress={applyAndReload}
          style={[styles.primaryAction, !isDirty && styles.actionDisabled]}
        >
          <Text style={styles.primaryActionLabel}>Apply &amp; reload</Text>
        </Pressable>
      </View>

      {probe.kind === 'done' ? (
        <Text style={[styles.probeResult, probe.ok ? styles.probeOk : styles.probeFail]}>
          {`${probe.ok ? 'reachable' : 'failed'} · ${probe.label}`}
        </Text>
      ) : null}

      <View style={styles.fields}>
        <Text style={styles.fieldLabel}>
          {auth.status === 'signedIn' ? `SIGNED IN AS ${auth.session?.user.email ?? ''}` : 'PASSWORD SIGN-IN'}
        </Text>
        <Field label="Email" onChangeText={setEmail} placeholder="root@local.host" styles={styles} value={email} />
        <Field label="Password" onChangeText={setPassword} placeholder="password" styles={styles} value={password} />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setSignInNote('signing in…')
            void signInWithPassword(email.trim(), password)
              .then(() => setSignInNote('signed in'))
              .catch((error: unknown) => setSignInNote(error instanceof Error ? error.message : 'sign-in failed'))
          }}
          style={styles.secondaryAction}
        >
          <Text style={styles.secondaryActionLabel}>Sign in</Text>
        </Pressable>
        {signInNote ? <Text style={styles.probeResult}>{signInNote}</Text> : null}
      </View>
    </View>
  )
}

function Field({
  label,
  onChangeText,
  placeholder,
  styles,
  value,
}: {
  label: string
  onChangeText: (value: string) => void
  placeholder: string
  styles: ReturnType<typeof createStyles>
  value: string
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.fieldInput}
        value={value}
      />
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 14,
      padding: 14,
    },
    presetRow: {
      backgroundColor: palette.bgCanvas,
      borderCurve: 'continuous',
      borderRadius: 10,
      flexDirection: 'row',
      gap: 2,
      padding: 2,
    },
    preset: { alignItems: 'center', borderCurve: 'continuous', borderRadius: 8, flex: 1, paddingVertical: 7 },
    presetSelected: { backgroundColor: palette.bgHover },
    presetLabel: { color: palette.textMuted, fontFamily: font.ui, fontSize: 11, fontWeight: '600' },
    presetLabelSelected: { color: palette.textPrimary },
    fields: { gap: 10 },
    field: { gap: 5 },
    fieldLabel: { color: palette.textSecondary, fontFamily: font.mono, fontSize: 9, letterSpacing: 0.8 },
    fieldInput: {
      backgroundColor: palette.bgCanvas,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 9,
      borderWidth: StyleSheet.hairlineWidth,
      color: palette.textPrimary,
      fontFamily: font.mono,
      fontSize: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    previewBlock: {
      backgroundColor: palette.bgCanvas,
      borderCurve: 'continuous',
      borderRadius: 10,
      gap: 3,
      padding: 10,
    },
    previewLabel: { color: palette.accentHi, fontFamily: font.mono, fontSize: 9, letterSpacing: 0.8 },
    previewValue: { color: palette.textPrimary, fontFamily: font.mono, fontSize: 11, marginBottom: 4 },
    actionRow: { flexDirection: 'row', gap: 8 },
    secondaryAction: {
      alignItems: 'center',
      backgroundColor: palette.bgHover,
      borderCurve: 'continuous',
      borderRadius: 10,
      flex: 1,
      paddingVertical: 10,
    },
    secondaryActionLabel: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 12, fontWeight: '600' },
    primaryAction: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderCurve: 'continuous',
      borderRadius: 10,
      flex: 1,
      paddingVertical: 10,
    },
    primaryActionLabel: { color: '#fff', fontFamily: font.ui, fontSize: 12, fontWeight: '700' },
    actionDisabled: { opacity: 0.4 },
    probeResult: { fontFamily: font.mono, fontSize: 11 },
    probeOk: { color: palette.textSecondary },
    probeFail: { color: palette.danger },
  })
}
