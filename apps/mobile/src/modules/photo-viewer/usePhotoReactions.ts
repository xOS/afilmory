import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

import { useTranslation } from '@/i18n'

import { addPhotoReaction, fetchPhotoReactionCounts } from './photoReactionApi'
import type { PhotoReaction, PhotoReactionState } from './photoReactionState'
import {
  addLocalReactions,
  createPhotoReactionState,
  mergePhotoReactionCounts,
  rollbackLocalReactions,
} from './photoReactionState'
import type { PhotoReactionFlush, PhotoReactionTally } from './photoReactionTally'
import {
  accumulateReactionTally,
  drainReactionTally,
  expireReactionTally,
  REACTION_MERGE_WINDOW_MS,
} from './photoReactionTally'

interface PhotoReactionSnapshot {
  key: string | null
  state: PhotoReactionState
}

function createSnapshot(key: string | null): PhotoReactionSnapshot {
  return { key, state: createPhotoReactionState() }
}

export function usePhotoReactions(gallerySlug: string | null, photoId: string | null) {
  const { t } = useTranslation()
  const key = gallerySlug && photoId ? `${gallerySlug}:${photoId}` : null
  const [snapshot, setSnapshot] = useState<PhotoReactionSnapshot>(() => createSnapshot(key))
  const [failureNonce, setFailureNonce] = useState(0)
  const snapshotRef = useRef(snapshot)
  const tallyRef = useRef<PhotoReactionTally | null>(null)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const publish = useCallback((next: PhotoReactionSnapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
  }, [])

  const submit = useCallback(
    (slug: string, id: string, ownerKey: string, flush: PhotoReactionFlush) => {
      void addPhotoReaction(slug, id, flush.reaction, flush.count)
        .then(() => {
          AccessibilityInfo.announceForAccessibility(
            flush.count > 1
              ? t('photo.reaction.burst', { count: flush.count, reaction: flush.reaction })
              : t('photo.reaction.success'),
          )
        })
        .catch((error) => {
          console.error('Failed to add photo reaction', error)
          const latest = snapshotRef.current
          if (latest.key === ownerKey) {
            publish({ ...latest, state: rollbackLocalReactions(latest.state, flush.reaction, flush.count) })
          }
          // The rail is native and JS has no haptic engine, so the bumped nonce
          // is what asks it to buzz.
          setFailureNonce(nonce => nonce + 1)
          AccessibilityInfo.announceForAccessibility(t('photo.reaction.failed'))
        })
    },
    [publish, t],
  )

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    publish(createSnapshot(key))
    if (!gallerySlug || !photoId || !key) {
      return
    }

    const controller = new AbortController()
    void fetchPhotoReactionCounts(gallerySlug, photoId, controller.signal)
      .then((counts) => {
        const current = snapshotRef.current
        if (!controller.signal.aborted && current.key === key) {
          publish({ ...current, state: mergePhotoReactionCounts(current.state, counts) })
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error('Failed to load photo reactions', error)
        }
      })

    return () => {
      controller.abort()
      clearFlushTimer()
      const { flush } = drainReactionTally(tallyRef.current)
      tallyRef.current = null
      if (flush) {
        submit(gallerySlug, photoId, key, flush)
      }
    }
  }, [clearFlushTimer, gallerySlug, key, photoId, publish, submit])

  const addReactions = useCallback(
    (reaction: PhotoReaction, count: number) => {
      if (!gallerySlug || !photoId || !key || count <= 0) {
        return
      }

      const current = snapshotRef.current.key === key ? snapshotRef.current : createSnapshot(key)
      publish({ ...current, state: addLocalReactions(current.state, reaction, count) })

      const step = accumulateReactionTally(tallyRef.current, reaction, count, Date.now())
      if (step.flush) {
        submit(gallerySlug, photoId, key, step.flush)
      }
      tallyRef.current = step.tally

      clearFlushTimer()
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null
        const expired = expireReactionTally(tallyRef.current, Date.now())
        tallyRef.current = expired.tally
        if (expired.flush) {
          submit(gallerySlug, photoId, key, expired.flush)
        }
      }, REACTION_MERGE_WINDOW_MS)
    },
    [clearFlushTimer, gallerySlug, key, photoId, publish, submit],
  )

  const current = snapshot.key === key ? snapshot : createSnapshot(key)
  return {
    addReactions,
    counts: current.state.counts,
    failureNonce,
  }
}
