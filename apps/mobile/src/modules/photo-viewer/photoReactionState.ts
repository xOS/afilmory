export const PHOTO_REACTIONS = ['👍', '😍', '🔥', '👏', '🌟', '🙌'] as const

export type PhotoReaction = (typeof PHOTO_REACTIONS)[number]

export interface PhotoReactionState {
  counts: Record<string, number>
  localDeltas: Record<string, number>
}

export function createPhotoReactionState(counts: Record<string, number> = {}): PhotoReactionState {
  return {
    counts: { ...counts },
    localDeltas: {},
  }
}

export function normalizePhotoReactionCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const counts: Record<string, number> = {}
  for (const [reaction, count] of Object.entries(value)) {
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
      counts[reaction] = Math.floor(count)
    }
  }
  return counts
}

function applyDelta(source: Record<string, number>, reaction: string, delta: number) {
  const next = { ...source }
  const value = Math.max(0, (next[reaction] ?? 0) + delta)
  if (value === 0) {
    delete next[reaction]
  }
  else {
    next[reaction] = value
  }
  return next
}

export function addLocalReactions(
  state: PhotoReactionState,
  reaction: PhotoReaction,
  count: number,
): PhotoReactionState {
  if (count <= 0) {
    return state
  }
  return {
    counts: applyDelta(state.counts, reaction, count),
    localDeltas: applyDelta(state.localDeltas, reaction, count),
  }
}

export function rollbackLocalReactions(
  state: PhotoReactionState,
  reaction: PhotoReaction,
  count: number,
): PhotoReactionState {
  if (count <= 0) {
    return state
  }
  return {
    counts: applyDelta(state.counts, reaction, -count),
    localDeltas: applyDelta(state.localDeltas, reaction, -count),
  }
}

// The initial snapshot can land after the viewer has already clapped, so the
// local deltas are replayed on top of it instead of being overwritten.
export function mergePhotoReactionCounts(
  state: PhotoReactionState,
  serverCounts: Record<string, number>,
): PhotoReactionState {
  let counts = normalizePhotoReactionCounts(serverCounts)
  for (const [reaction, delta] of Object.entries(state.localDeltas)) {
    counts = applyDelta(counts, reaction, delta)
  }
  return { ...state, counts }
}
