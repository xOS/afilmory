import { useSyncExternalStore } from 'react'

import type { DatePreset, PhotoFilters, TagMode } from './filterTypes'
import { EMPTY_FILTERS, presetRange } from './filterTypes'

let state: PhotoFilters = EMPTY_FILTERS
const listeners = new Set<() => void>()

function setState(next: PhotoFilters) {
  state = next
  for (const listener of listeners) {
    listener()
  }
}

function getSnapshot(): PhotoFilters {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFilters(): PhotoFilters {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(candidate => candidate !== value) : [...values, value]
}

export function toggleTag(tag: string): void {
  setState({ ...state, tags: toggleValue(state.tags, tag) })
}

export function setTagMode(mode: TagMode): void {
  setState({ ...state, tagMode: mode })
}

export function setDatePreset(preset: DatePreset | null): void {
  if (preset === null) {
    setState({ ...state, datePreset: null, dateFrom: null, dateTo: null })
    return
  }
  const { from, to } = presetRange(preset, new Date())
  setState({ ...state, datePreset: preset, dateFrom: from, dateTo: to })
}

export function setCustomRange(from: string | null, to: string | null): void {
  setState({ ...state, datePreset: null, dateFrom: from, dateTo: to })
}

export function toggleCamera(name: string): void {
  setState({ ...state, cameras: toggleValue(state.cameras, name) })
}

export function toggleLens(name: string): void {
  setState({ ...state, lenses: toggleValue(state.lenses, name) })
}

export function setMinRating(rating: number | null): void {
  setState({ ...state, minRating: rating })
}

export function clearFilters(): void {
  setState(EMPTY_FILTERS)
}

export function replaceFilters(next: PhotoFilters): void {
  if (next.datePreset === null) {
    setState(next)
    return
  }

  const { from, to } = presetRange(next.datePreset, new Date())
  setState({ ...next, dateFrom: from, dateTo: to })
}
