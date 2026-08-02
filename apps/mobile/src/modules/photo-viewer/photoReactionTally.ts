import type { PhotoReaction } from './photoReactionState'

export const REACTION_MERGE_WINDOW_MS = 800

export interface PhotoReactionTally {
  count: number
  deadline: number
  reaction: PhotoReaction
}

export interface PhotoReactionFlush {
  count: number
  reaction: PhotoReaction
}

export interface PhotoReactionTallyStep {
  flush: PhotoReactionFlush | null
  tally: PhotoReactionTally | null
}

function toFlush(tally: PhotoReactionTally | null): PhotoReactionFlush | null {
  return tally ? { count: tally.count, reaction: tally.reaction } : null
}

export function accumulateReactionTally(
  current: PhotoReactionTally | null,
  reaction: PhotoReaction,
  count: number,
  now: number,
  windowMs: number = REACTION_MERGE_WINDOW_MS,
): PhotoReactionTallyStep {
  if (count <= 0) {
    return { flush: null, tally: current }
  }

  const extendsCurrent = current !== null && current.reaction === reaction && now < current.deadline
  return {
    flush: extendsCurrent ? null : toFlush(current),
    tally: {
      count: extendsCurrent ? current.count + count : count,
      deadline: now + windowMs,
      reaction,
    },
  }
}

export function expireReactionTally(current: PhotoReactionTally | null, now: number): PhotoReactionTallyStep {
  if (current === null || now < current.deadline) {
    return { flush: null, tally: current }
  }
  return { flush: toFlush(current), tally: null }
}

export function drainReactionTally(current: PhotoReactionTally | null): PhotoReactionTallyStep {
  return { flush: toFlush(current), tally: null }
}
