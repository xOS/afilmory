import { useRouter } from 'expo-router'
import { SymbolView } from 'expo-symbols'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import type { Palette } from '@/theme/palette'
import { font, radiusLg } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'

import { ApiEnvironmentSection } from './ApiEnvironmentSection'
import type {
  CommentSendScenarioParams,
  DevLabMotionMode,
  DevLabOutcome,
  DevLabRouteParams,
  DevLabValidationIssue,
  ParsedDevLabParams,
} from './params'
import {
  COMMENT_SEND_SCENARIO_DEFAULTS,
  COMMENT_SEND_SCENARIO_ID,
  parseDevLabParams,
  serializeDevLabParams,
} from './params'
import { DEV_LAB_SCENARIOS } from './registry'
import { CommentSendFlightScenario } from './scenarios/CommentSendFlightScenario'

interface DevLabFormState {
  duration: string
  latency: string
  lift: string
  message: string
  motion: DevLabMotionMode
  outcome: DevLabOutcome
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

function createFormState(input: DevLabRouteParams, safe: CommentSendScenarioParams): DevLabFormState {
  const motion = single(input.motion)
  const outcome = single(input.outcome)
  return {
    duration: single(input.duration) ?? String(safe.durationMs),
    latency: single(input.latency) ?? String(safe.latencyMs),
    lift: single(input.lift) ?? String(safe.lift),
    message: single(input.message) ?? safe.message,
    motion: motion === 'always' || motion === 'never' || motion === 'system' ? motion : safe.motion,
    outcome: outcome === 'failure' || outcome === 'success' ? outcome : safe.outcome,
  }
}

export function DevLabScreen({
  initialInput,
  initialParsed,
}: {
  initialInput: DevLabRouteParams
  initialParsed: ParsedDevLabParams
}) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const router = useRouter()
  const [form, setForm] = useState<DevLabFormState>(() => createFormState(initialInput, initialParsed.value))
  const [activeParams, setActiveParams] = useState(initialParsed.value)
  const [issues, setIssues] = useState<DevLabValidationIssue[]>(initialParsed.issues)
  const scenario = DEV_LAB_SCENARIOS[0]

  const updateForm = <K extends keyof DevLabFormState>(key: K, value: DevLabFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const applyParameters = () => {
    const routeParams = {
      duration: form.duration,
      latency: form.latency,
      lift: form.lift,
      message: form.message,
      motion: form.motion,
      outcome: form.outcome,
      scene: COMMENT_SEND_SCENARIO_ID,
    }
    const parsed = parseDevLabParams(routeParams)
    setActiveParams(parsed.value)
    setIssues(parsed.issues)
    router.setParams(routeParams)
  }

  const resetParameters = () => {
    const routeParams = serializeDevLabParams(COMMENT_SEND_SCENARIO_DEFAULTS)
    setForm(createFormState(routeParams, COMMENT_SEND_SCENARIO_DEFAULTS))
    setActiveParams(COMMENT_SEND_SCENARIO_DEFAULTS)
    setIssues([])
    router.setParams(routeParams)
  }

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
          <Text style={styles.environmentTitle}>Development surface</Text>
          <Text style={styles.environmentDescription}>This root-level route exists only in development builds.</Text>
        </View>
        <Text style={styles.environmentBadge}>DEV</Text>
      </View>

      <SectionHeading
        eyebrow="API ENVIRONMENT"
        subtitle="Point the app at the local stack or back at production"
        title="Backend target"
      />

      <ApiEnvironmentSection />

      <SectionHeading
        eyebrow="SCENARIO REGISTRY"
        subtitle={`${DEV_LAB_SCENARIOS.length} registered component scenario`}
        title="Interactive component review"
      />

      <View style={styles.scenarioCard}>
        <View style={styles.scenarioTopRow}>
          <View style={styles.scenarioIndex}>
            <Text style={styles.scenarioIndexLabel}>01</Text>
          </View>
          <View style={styles.scenarioCopy}>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioId}>{scenario.id}</Text>
          </View>
          <Text style={styles.parameterBadge}>
            {scenario.parameterCount}
            {' '}
            params
          </Text>
        </View>
        <Text style={styles.scenarioDescription}>{scenario.description}</Text>
        <View style={styles.coverageRow}>
          {['UI', 'Motion', 'Failure', 'A11y', 'Params'].map(item => (
            <View key={item} style={styles.coveragePill}>
              <Text style={styles.coverageLabel}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <SectionHeading
        eyebrow="PREVIEW"
        subtitle="Edit the composer, send the message, and observe its final placement."
        title="Real component runtime"
      />
      <CommentSendFlightScenario params={activeParams} />

      <SectionHeading
        eyebrow="PARAMETERS"
        subtitle="Apply values to the preview and mirror them into the current route query."
        title="Scenario controls"
      />
      <View style={styles.parameterPanel}>
        <ParameterField
          description="1–280 characters"
          label="Message"
          multiline
          value={form.message}
          onChange={value => updateForm('message', value)}
        />
        <View style={styles.twoColumnRow}>
          <View style={styles.column}>
            <ParameterField
              description="120–1600 ms"
              keyboard="number-pad"
              label="Duration"
              value={form.duration}
              onChange={value => updateForm('duration', value)}
            />
          </View>
          <View style={styles.column}>
            <ParameterField
              description="0–5000 ms"
              keyboard="number-pad"
              label="API latency"
              value={form.latency}
              onChange={value => updateForm('latency', value)}
            />
          </View>
        </View>
        <ParameterField
          description="Trajectory lift, 0–48 pt"
          keyboard="number-pad"
          label="Lift"
          value={form.lift}
          onChange={value => updateForm('lift', value)}
        />

        <SegmentedParameter
          label="Outcome"
          options={[
            { label: 'Success', value: 'success' },
            { label: 'Failure', value: 'failure' },
          ]}
          value={form.outcome}
          onChange={value => updateForm('outcome', value)}
        />
        <SegmentedParameter
          label="Reduced motion"
          options={[
            { label: 'System', value: 'system' },
            { label: 'Always', value: 'always' },
            { label: 'Never', value: 'never' },
          ]}
          value={form.motion}
          onChange={value => updateForm('motion', value)}
        />

        <View style={styles.parameterActions}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={resetParameters}
          >
            <Text style={styles.secondaryButtonLabel}>Reset</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={applyParameters}
          >
            <SymbolView name="checkmark" size={13} tintColor={palette.accentContrast} weight="bold" />
            <Text style={styles.primaryButtonLabel}>Apply to preview</Text>
          </Pressable>
        </View>
      </View>

      <ValidationPanel issues={issues} params={activeParams} />
    </ScrollView>
  )
}

function SectionHeading({ eyebrow, subtitle, title }: { eyebrow: string, subtitle: string, title: string }) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  )
}

function ParameterField({
  description,
  keyboard = 'default',
  label,
  multiline = false,
  onChange,
  value,
}: {
  description: string
  keyboard?: 'default' | 'number-pad'
  label: string
  multiline?: boolean
  onChange: (value: string) => void
  value: string
}) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldDescription}>{description}</Text>
      </View>
      <TextInput
        autoCapitalize="none"
        autoCorrect={multiline}
        keyboardType={keyboard}
        multiline={multiline}
        selectionColor={palette.accent}
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChange}
      />
    </View>
  )
}

function SegmentedParameter<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string
  onChange: (value: T) => void
  options: ReadonlyArray<{ label: string, value: T }>
  value: T
}) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.segmentedControl}>
        {options.map(option => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: option.value === value }}
            style={({ pressed }) => [
              styles.segment,
              option.value === value && styles.segmentSelected,
              pressed && styles.pressed,
            ]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.segmentLabel, option.value === value && styles.segmentLabelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

function ValidationPanel({ issues, params }: { issues: DevLabValidationIssue[], params: CommentSendScenarioParams }) {
  const { palette } = useTheme()
  const styles = useMemo(() => createStyles(palette), [palette])
  const valid = issues.length === 0
  return (
    <View style={[styles.validationPanel, !valid && styles.validationPanelError]}>
      <View style={styles.validationHeader}>
        <SymbolView
          name={valid ? 'checkmark.seal.fill' : 'exclamationmark.triangle.fill'}
          size={18}
          tintColor={valid ? '#30d158' : palette.danger}
        />
        <View style={styles.validationCopy}>
          <Text style={styles.validationTitle}>{valid ? 'Parameters valid' : 'Validation fallback applied'}</Text>
          <Text style={styles.validationDescription}>
            {valid
              ? 'The preview is using the route contract shown below.'
              : `${issues.length} invalid value${issues.length === 1 ? '' : 's'} replaced with safe defaults.`}
          </Text>
        </View>
      </View>
      {issues.map(issue => (
        <View key={`${issue.field}:${issue.message}:${issue.value ?? 'undefined'}`} style={styles.issueRow}>
          <Text style={styles.issueField}>{issue.field}</Text>
          <Text style={styles.issueMessage}>{issue.message}</Text>
          {issue.value === undefined ? null : <Text style={styles.issueValue}>{issue.value}</Text>}
        </View>
      ))}
      <View style={styles.routeExample}>
        <Text style={styles.routeLabel}>EFFECTIVE ROUTE</Text>
        <Text selectable style={styles.routeValue}>
          {`/dev?scene=${params.scene}&duration=${params.durationMs}&latency=${params.latencyMs}&lift=${params.lift}&motion=${params.motion}&outcome=${params.outcome}`}
        </Text>
      </View>
    </View>
  )
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    root: { backgroundColor: palette.bgCanvas, flex: 1 },
    content: { gap: 18, paddingBottom: 120, paddingHorizontal: 16, paddingTop: 12 },
    environmentBanner: {
      alignItems: 'center',
      backgroundColor: palette.accentDim,
      borderColor: palette.accentLine,
      borderCurve: 'continuous',
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      gap: 11,
      padding: 13,
    },
    environmentIcon: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 123, 255, 0.16)',
      borderCurve: 'continuous',
      borderRadius: 10,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    environmentCopy: { flex: 1, gap: 2 },
    environmentTitle: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 13, fontWeight: '700' },
    environmentDescription: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 11, lineHeight: 15 },
    environmentBadge: {
      color: palette.accentHi,
      fontFamily: font.mono,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
    },
    sectionHeading: { gap: 4, marginTop: 8 },
    sectionEyebrow: {
      color: palette.accentHi,
      fontFamily: font.mono,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
    },
    sectionTitle: {
      color: palette.textPrimary,
      fontFamily: font.ui,
      fontSize: 21,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    sectionSubtitle: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 12, lineHeight: 17 },
    scenarioCard: {
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 12,
      padding: 14,
    },
    scenarioTopRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
    scenarioIndex: {
      alignItems: 'center',
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 11,
      height: 38,
      justifyContent: 'center',
      width: 38,
    },
    scenarioIndexLabel: { color: palette.accentHi, fontFamily: font.mono, fontSize: 11, fontWeight: '700' },
    scenarioCopy: { flex: 1, gap: 2 },
    scenarioTitle: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 15, fontWeight: '700' },
    scenarioId: { color: palette.textMuted, fontFamily: font.mono, fontSize: 9 },
    parameterBadge: {
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 999,
      color: palette.textSecondary,
      fontFamily: font.mono,
      fontSize: 9,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    scenarioDescription: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 12, lineHeight: 17 },
    coverageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    coveragePill: {
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    coverageLabel: { color: palette.textMuted, fontFamily: font.mono, fontSize: 9, fontWeight: '600' },
    parameterPanel: {
      backgroundColor: palette.bgSurface,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 16,
      padding: 15,
    },
    field: { gap: 7 },
    fieldHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    fieldLabel: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 12, fontWeight: '600' },
    fieldDescription: { color: palette.textMuted, fontFamily: font.mono, fontSize: 9 },
    fieldInput: {
      backgroundColor: palette.bgElement,
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      color: palette.textPrimary,
      fontFamily: font.mono,
      fontSize: 12,
      minHeight: 42,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    fieldInputMultiline: { fontFamily: font.ui, lineHeight: 18, minHeight: 76, textAlignVertical: 'top' },
    twoColumnRow: { flexDirection: 'row', gap: 10 },
    column: { flex: 1 },
    segmentedControl: {
      backgroundColor: palette.bgElement,
      borderCurve: 'continuous',
      borderRadius: 11,
      flexDirection: 'row',
      padding: 3,
    },
    segment: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: 8,
      flex: 1,
      justifyContent: 'center',
      minHeight: 34,
      paddingHorizontal: 6,
    },
    segmentSelected: { backgroundColor: palette.bgHover },
    segmentLabel: { color: palette.textMuted, fontFamily: font.ui, fontSize: 11, fontWeight: '600' },
    segmentLabelSelected: { color: palette.textPrimary },
    parameterActions: { flexDirection: 'row', gap: 9, justifyContent: 'flex-end', paddingTop: 2 },
    secondaryButton: {
      alignItems: 'center',
      borderColor: palette.border,
      borderCurve: 'continuous',
      borderRadius: 11,
      borderWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 16,
    },
    secondaryButtonLabel: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 12, fontWeight: '600' },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: palette.accent,
      borderCurve: 'continuous',
      borderRadius: 11,
      flexDirection: 'row',
      gap: 7,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 16,
    },
    primaryButtonLabel: { color: palette.accentContrast, fontFamily: font.ui, fontSize: 12, fontWeight: '700' },
    validationPanel: {
      backgroundColor: 'rgba(48, 209, 88, 0.08)',
      borderColor: 'rgba(48, 209, 88, 0.3)',
      borderCurve: 'continuous',
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 10,
      padding: 14,
    },
    validationPanelError: { backgroundColor: 'rgba(255, 69, 58, 0.08)', borderColor: 'rgba(255, 69, 58, 0.3)' },
    validationHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
    validationCopy: { flex: 1, gap: 3 },
    validationTitle: { color: palette.textPrimary, fontFamily: font.ui, fontSize: 13, fontWeight: '700' },
    validationDescription: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 11, lineHeight: 15 },
    issueRow: {
      backgroundColor: 'rgba(0, 0, 0, 0.18)',
      borderCurve: 'continuous',
      borderRadius: 10,
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    issueField: { color: palette.danger, fontFamily: font.mono, fontSize: 10, fontWeight: '700' },
    issueMessage: { color: palette.textSecondary, fontFamily: font.ui, fontSize: 11 },
    issueValue: { color: palette.textMuted, fontFamily: font.mono, fontSize: 9 },
    routeExample: {
      backgroundColor: 'rgba(0, 0, 0, 0.24)',
      borderCurve: 'continuous',
      borderRadius: 10,
      gap: 5,
      padding: 10,
    },
    routeLabel: { color: palette.textMuted, fontFamily: font.mono, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
    routeValue: { color: palette.textSecondary, fontFamily: font.mono, fontSize: 9, lineHeight: 14 },
    pressed: { opacity: 0.58 },
  })
}
