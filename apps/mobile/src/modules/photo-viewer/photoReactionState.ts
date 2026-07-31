export const PHOTO_REACTIONS = ['👍', '😍', '🔥', '👏', '🌟', '🙌'] as const

export type PhotoReaction = (typeof PHOTO_REACTIONS)[number]

export interface PhotoReactionState {
  activeReactions: PhotoReaction[]
  counts: Record<string, number>
}

export function createPhotoReactionState(counts: Record<string, number> = {}): PhotoReactionState {
  return {
    activeReactions: [],
    counts: { ...counts },
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

function applyCountDelta(counts: Record<string, number>, reaction: PhotoReaction, delta: number) {
  const nextCounts = { ...counts }
  const nextCount = Math.max(0, (nextCounts[reaction] ?? 0) + delta)
  if (nextCount === 0) {
    delete nextCounts[reaction]
  }
  else {
    nextCounts[reaction] = nextCount
  }
  return nextCounts
}

export function toggleLocalPhotoReaction(state: PhotoReactionState, reaction: PhotoReaction): PhotoReactionState {
  const isActive = state.activeReactions.includes(reaction)
  return {
    activeReactions: isActive
      ? state.activeReactions.filter(item => item !== reaction)
      : [...state.activeReactions, reaction],
    counts: applyCountDelta(state.counts, reaction, isActive ? -1 : 1),
  }
}

export function rollbackLocalPhotoReaction(state: PhotoReactionState, reaction: PhotoReaction): PhotoReactionState {
  if (!state.activeReactions.includes(reaction)) {
    return state
  }
  return toggleLocalPhotoReaction(state, reaction)
}

export function mergePhotoReactionCounts(
  state: PhotoReactionState,
  serverCounts: Record<string, number>,
): PhotoReactionState {
  let counts = normalizePhotoReactionCounts(serverCounts)
  for (const reaction of state.activeReactions) {
    counts = applyCountDelta(counts, reaction, 1)
  }
  return { ...state, counts }
}
