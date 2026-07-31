import type { UiFieldComponent, UiFieldNode } from '../types'

const HEX_COLOR_PATTERN = /^#[\dA-F]{6}(?:[\dA-F]{2})?$/i

const identifierKeys = new Set([
  'site.feed.folo.challenge.feedId',
  'site.feed.folo.challenge.userId',
  'site.mapStyle',
  'site.social.github',
  'site.social.twitter',
])

export function resolveNativeFieldComponent(field: UiFieldNode): UiFieldComponent {
  if (field.key === 'site.accentColor') {
    return { type: 'color', supportsOpacity: false }
  }
  if (field.key === 'site.map.providers') {
    return { type: 'multiSelect', options: ['maplibre'] }
  }
  if (field.key === 'site.mapProjection' && field.component.type === 'select') {
    return { ...field.component, presentation: 'segmented' }
  }
  if (identifierKeys.has(field.key) && field.component.type === 'text') {
    return { ...field.component, autoCapitalize: 'none', autoCorrect: false }
  }
  return field.component
}

export function normalizeColorSelection(value: string): string | null {
  return HEX_COLOR_PATTERN.test(value) ? value.toUpperCase() : null
}

export function parseMultiSelectValue(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return []
    }
    return Array.from(new Set(parsed.filter((item): item is string => typeof item === 'string')))
  }
  catch {
    return []
  }
}

export function updateMultiSelectValue(value: string, option: string, selected: boolean): string {
  const current = new Set(parseMultiSelectValue(value))
  if (selected) {
    current.add(option)
  }
  else {
    current.delete(option)
  }
  return JSON.stringify(Array.from(current))
}

export function formatSettingOption(option: string): string {
  if (option === 'maplibre') {
    return 'MapLibre'
  }
  return option.length === 0 ? option : `${option[0].toUpperCase()}${option.slice(1)}`
}
