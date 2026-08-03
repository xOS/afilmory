import type { UiFieldNode, UiNode } from './types'

export function formatBytes(value: number | null | undefined, locale: string): string {
  if (!value || value < 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  const amount = value / 1024 ** unitIndex
  return `${amount.toLocaleString(locale, { maximumFractionDigits: amount >= 10 ? 1 : 2 })} ${units[unitIndex]}`
}

export function formatCount(value: number, locale: string): string {
  return value.toLocaleString(locale)
}

export function formatDateTime(value: string | null | undefined, locale: string): string | null {
  if (!value) {
    return null
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function formatTrendMonth(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return value
  }
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) {
    return value
  }
  return new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

export function collectSettingFields(nodes: readonly UiNode[]): UiFieldNode[] {
  const fields: UiFieldNode[] = []
  for (const node of nodes) {
    if (node.type === 'field') {
      if (!node.hidden) {
        fields.push(node)
      }
      continue
    }
    fields.push(...collectSettingFields(node.children))
  }
  return fields
}
