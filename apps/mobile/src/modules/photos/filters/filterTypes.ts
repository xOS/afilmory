export type DatePreset = 'last7' | 'last30' | 'last90' | 'thisMonth' | 'thisYear' | 'lastYear'
export type TagMode = 'any' | 'all'

export interface PhotoFilters {
  tags: string[]
  tagMode: TagMode
  datePreset: DatePreset | null
  dateFrom: string | null
  dateTo: string | null
  cameras: string[]
  lenses: string[]
  minRating: number | null
}

export const EMPTY_FILTERS: PhotoFilters = {
  tags: [],
  tagMode: 'any',
  datePreset: null,
  dateFrom: null,
  dateTo: null,
  cameras: [],
  lenses: [],
  minRating: null,
}

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  last90: 'Last 90 days',
  thisMonth: 'This month',
  thisYear: 'This year',
  lastYear: 'Last year',
}

export function countActiveDimensions(filters: PhotoFilters): number {
  let count = 0
  if (filters.tags.length > 0) {
    count++
  }
  if (filters.dateFrom !== null || filters.dateTo !== null) {
    count++
  }
  if (filters.cameras.length > 0) {
    count++
  }
  if (filters.lenses.length > 0) {
    count++
  }
  if (filters.minRating !== null) {
    count++
  }
  return count
}

export function hasActiveFilters(filters: PhotoFilters): boolean {
  return countActiveDimensions(filters) > 0
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function presetRange(preset: DatePreset, now: Date): { from: string, to: string } {
  const today = toDateString(now)
  switch (preset) {
    case 'last7': {
      return { from: toDateString(addDays(now, -6)), to: today }
    }
    case 'last30': {
      return { from: toDateString(addDays(now, -29)), to: today }
    }
    case 'last90': {
      return { from: toDateString(addDays(now, -89)), to: today }
    }
    case 'thisMonth': {
      return { from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, to: today }
    }
    case 'thisYear': {
      return { from: `${now.getFullYear()}-01-01`, to: today }
    }
    case 'lastYear': {
      const year = now.getFullYear() - 1
      return { from: `${year}-01-01`, to: `${year}-12-31` }
    }
  }
}

export function summarizeFilters(filters: PhotoFilters): string {
  const parts: string[] = []

  if (filters.tags.length > 0) {
    parts.push(filters.tags.length === 1 ? filters.tags[0] : `${filters.tags.length} tags`)
  }
  if (filters.dateFrom !== null || filters.dateTo !== null) {
    parts.push(filters.datePreset ? DATE_PRESET_LABELS[filters.datePreset] : 'Dates')
  }
  if (filters.cameras.length > 0) {
    parts.push(filters.cameras.length === 1 ? filters.cameras[0] : `${filters.cameras.length} cameras`)
  }
  if (filters.lenses.length > 0) {
    parts.push(filters.lenses.length === 1 ? filters.lenses[0] : `${filters.lenses.length} lenses`)
  }
  if (filters.minRating !== null) {
    parts.push(`≥${filters.minRating}★`)
  }

  return parts.join(' · ')
}
