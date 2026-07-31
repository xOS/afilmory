import {
  ColorPicker,
  Form,
  Picker,
  Section,
  SecureField,
  Text,
  TextField,
  Toggle,
  useNativeState,
  VStack,
} from '@expo/ui/swift-ui'
import {
  autocorrectionDisabled,
  defaultScrollAnchorForRole,
  font,
  foregroundStyle,
  keyboardType,
  labelsHidden,
  lineLimit,
  listStyle,
  pickerStyle,
  refreshable,
  scrollDismissesKeyboard,
  tag,
  textInputAutocapitalization,
} from '@expo/ui/swift-ui/modifiers'
import { Stack } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Alert } from 'react-native'

import { useTranslation } from '@/i18n'

import { getSiteSettings, updateSiteSettings } from '../api'
import { collectSettingFields } from '../format'
import { StudioAccessBoundary, StudioErrorState, StudioHost, StudioLoadingState } from '../StudioNative'
import type { SiteSettingKey, SiteSettingUiSchemaResponse, UiFieldNode } from '../types'
import { useRemoteResource } from '../useRemoteResource'
import {
  formatSettingOption,
  normalizeColorSelection,
  parseMultiSelectValue,
  resolveNativeFieldComponent,
  updateMultiSelectValue,
} from './siteFieldModel'

type SiteDraft = Record<SiteSettingKey, string>

export function StudioSiteScreen() {
  return (
    <StudioAccessBoundary>
      <StudioSiteLoader />
    </StudioAccessBoundary>
  )
}

function StudioSiteLoader() {
  const load = useCallback(() => getSiteSettings(), [])
  const resource = useRemoteResource(load, [load])

  if (resource.loading && !resource.data) {
    return <StudioLoadingState />
  }
  if (resource.error && !resource.data) {
    return <StudioErrorState message={resource.error.message} onRetry={() => void resource.reload()} />
  }
  if (!resource.data) {
    return null
  }

  return (
    <StudioSiteForm
      key={JSON.stringify(resource.data.values)}
      data={resource.data}
      onRefresh={async () => void (await resource.reload())}
    />
  )
}

function StudioSiteForm({ data, onRefresh }: { data: SiteSettingUiSchemaResponse, onRefresh: () => Promise<void> }) {
  const { t } = useTranslation()
  const initial = useMemo(() => buildDraft(data), [data])
  const [baseline, setBaseline] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)

  const changedEntries = useMemo(
    () =>
      (Object.keys(draft) as SiteSettingKey[])
        .filter(key => draft[key] !== baseline[key])
        .map(key => ({ key, value: draft[key] })),
    [baseline, draft],
  )

  const change = useCallback((key: SiteSettingKey, value: string) => {
    setDraft(current => ({ ...current, [key]: value }))
  }, [])

  const save = useCallback(async () => {
    if (saving || changedEntries.length === 0) {
      return
    }
    setSaving(true)
    try {
      await updateSiteSettings(changedEntries)
      setBaseline(draft)
      Alert.alert(t('studio.site.saved.title'), t('studio.site.saved.description'))
    }
    catch (error) {
      Alert.alert(t('studio.site.saveFailed'), error instanceof Error ? error.message : undefined)
    }
    finally {
      setSaving(false)
    }
  }, [changedEntries, draft, saving, t])

  const refresh = useCallback(async () => {
    if (changedEntries.length > 0) {
      return
    }
    await onRefresh()
  }, [changedEntries.length, onRefresh])

  return (
    <StudioHost>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          disabled={changedEntries.length === 0 || saving}
          variant="done"
          onPress={() => void save()}
        >
          {saving ? t('common.saving') : t('common.save')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Form
        modifiers={[
          listStyle('insetGrouped'),
          defaultScrollAnchorForRole('top', 'sizeChanges'),
          scrollDismissesKeyboard('interactively'),
          refreshable(refresh),
        ]}
      >
        {data.schema.sections.map((section) => {
          const fields = collectSettingFields(section.children)
          return (
            <Section
              key={section.id}
              footer={section.description ? <Text>{section.description}</Text> : undefined}
              title={section.title}
            >
              {fields.map(field => (
                <NativeSettingField
                  key={field.key}
                  field={field}
                  value={draft[field.key]}
                  onChange={value => change(field.key, value)}
                />
              ))}
            </Section>
          )
        })}
      </Form>
    </StudioHost>
  )
}

function NativeSettingField({
  field,
  onChange,
  value,
}: {
  field: UiFieldNode
  onChange: (value: string) => void
  value: string
}) {
  const { t } = useTranslation()
  const nativeText = useNativeState(value)
  const component = resolveNativeFieldComponent(field)
  const helper
    = field.key === 'site.accentColor'
      ? t('studio.site.field.accentColor.helper')
      : field.key === 'site.map.providers'
        ? t('studio.site.field.mapProviders.helper')
        : field.key === 'site.mapProjection'
          ? t('studio.site.field.mapProjection.helper')
          : (field.helperText ?? field.description)

  if (component.type === 'color') {
    return (
      <VStack alignment="leading" spacing={5}>
        <ColorPicker
          label={field.title}
          selection={normalizeColorSelection(value)}
          supportsOpacity={component.supportsOpacity ?? false}
          onSelectionChange={onChange}
        />
        <NativeFieldHelper text={helper} />
      </VStack>
    )
  }

  if (component.type === 'multiSelect') {
    const selectedOptions = new Set(parseMultiSelectValue(value))
    return (
      <VStack alignment="leading" spacing={8}>
        <Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' })]}>{field.title}</Text>
        {component.options.map(option => (
          <Toggle
            key={option}
            isOn={selectedOptions.has(option)}
            label={formatSettingOption(option)}
            onIsOnChange={selected => onChange(updateMultiSelectValue(value, option, selected))}
          />
        ))}
        <NativeFieldHelper text={helper} />
      </VStack>
    )
  }

  if (component.type === 'select') {
    const segmented = component.presentation === 'segmented'
    return (
      <VStack alignment="leading" spacing={8}>
        {segmented ? (
          <Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' })]}>{field.title}</Text>
        ) : null}
        <Picker
          label={field.title}
          modifiers={[
            pickerStyle(
              segmented ? 'segmented' : component.presentation === 'navigationLink' ? 'navigationLink' : 'menu',
            ),
            ...(segmented ? [labelsHidden()] : []),
          ]}
          selection={value}
          onSelectionChange={selection => onChange(String(selection ?? ''))}
        >
          {(component.options ?? []).map(option => (
            <Text key={option} modifiers={[tag(option)]}>
              {formatSettingOption(option)}
            </Text>
          ))}
        </Picker>
        <NativeFieldHelper text={helper} />
      </VStack>
    )
  }

  if (component.type === 'switch') {
    return (
      <VStack alignment="leading" spacing={5}>
        <Toggle isOn={value === 'true'} label={field.title} onIsOnChange={enabled => onChange(String(enabled))} />
        <NativeFieldHelper text={helper} />
      </VStack>
    )
  }

  if (component.type === 'slot') {
    return null
  }

  const isUrl = component.type === 'text' && component.inputType === 'url'
  const autoCapitalize = component.type === 'text' ? component.autoCapitalize : undefined
  const inputModifiers = [
    textInputAutocapitalization(autoCapitalize === 'none' || isUrl ? 'never' : (autoCapitalize ?? 'sentences')),
    autocorrectionDisabled(component.type === 'text' && (component.autoCorrect === false || isUrl)),
    ...(isUrl ? [keyboardType('url')] : []),
    ...(component.type === 'text' && component.inputType === 'email' ? [keyboardType('email-address')] : []),
    ...(component.type === 'text' && component.inputType === 'number' ? [keyboardType('numeric')] : []),
    ...(component.type === 'textarea' ? [lineLimit({ min: component.minRows ?? 3, max: component.maxRows ?? 6 })] : []),
  ]

  return (
    <VStack alignment="leading" spacing={5}>
      <Text modifiers={[font({ textStyle: 'subheadline', weight: 'medium' })]}>{field.title}</Text>
      {component.type === 'secret' ? (
        <SecureField placeholder={component.placeholder} text={nativeText} onTextChange={onChange} />
      ) : (
        <TextField
          axis={component.type === 'textarea' ? 'vertical' : 'horizontal'}
          modifiers={inputModifiers}
          placeholder={component.placeholder}
          text={nativeText}
          onTextChange={onChange}
        />
      )}
      <NativeFieldHelper text={helper} />
    </VStack>
  )
}

function NativeFieldHelper({ text }: { text?: string | null }) {
  if (!text) {
    return null
  }
  return (
    <Text modifiers={[foregroundStyle({ style: 'secondary', type: 'hierarchical' }), font({ textStyle: 'caption' })]}>
      {text}
    </Text>
  )
}

function buildDraft(data: SiteSettingUiSchemaResponse): SiteDraft {
  const draft = {} as SiteDraft
  for (const section of data.schema.sections) {
    for (const field of collectSettingFields(section.children)) {
      draft[field.key] = data.values[field.key] ?? ''
    }
  }
  return draft
}
