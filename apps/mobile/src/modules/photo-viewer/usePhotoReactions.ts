import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Alert } from 'react-native'

import { useTranslation } from '@/i18n'

import { addPhotoReaction, fetchPhotoReactionCounts } from './photoReactionApi'
import type { PhotoReaction, PhotoReactionState } from './photoReactionState'
import {
  createPhotoReactionState,
  mergePhotoReactionCounts,
  rollbackLocalPhotoReaction,
  toggleLocalPhotoReaction,
} from './photoReactionState'

interface PhotoReactionSnapshot {
  key: string | null
  pending: ReadonlySet<PhotoReaction>
  state: PhotoReactionState
}

function createSnapshot(key: string | null): PhotoReactionSnapshot {
  return { key, pending: new Set(), state: createPhotoReactionState() }
}

export function usePhotoReactions(gallerySlug: string | null, photoId: string | null) {
  const { t } = useTranslation()
  const key = gallerySlug && photoId ? `${gallerySlug}:${photoId}` : null
  const [snapshot, setSnapshot] = useState<PhotoReactionSnapshot>(() => createSnapshot(key))
  const snapshotRef = useRef(snapshot)

  const publish = useCallback((next: PhotoReactionSnapshot) => {
    snapshotRef.current = next
    setSnapshot(next)
  }, [])

  useEffect(() => {
    const initial = createSnapshot(key)
    publish(initial)
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
    return () => controller.abort()
  }, [gallerySlug, key, photoId, publish])

  const addReaction = useCallback(
    (reaction: PhotoReaction) => {
      if (!gallerySlug || !photoId || !key) {
        return
      }

      const current = snapshotRef.current.key === key ? snapshotRef.current : createSnapshot(key)
      if (current.pending.has(reaction)) {
        return
      }

      const wasActive = current.state.activeReactions.includes(reaction)
      const toggled = toggleLocalPhotoReaction(current.state, reaction)
      if (wasActive) {
        publish({ ...current, state: toggled })
        return
      }

      const pending = new Set(current.pending)
      pending.add(reaction)
      publish({ ...current, pending, state: toggled })

      void addPhotoReaction(gallerySlug, photoId, reaction)
        .then(() => AccessibilityInfo.announceForAccessibility(t('photo.reaction.success')))
        .catch((error) => {
          console.error('Failed to add photo reaction', error)
          const latest = snapshotRef.current
          if (latest.key === key) {
            publish({ ...latest, state: rollbackLocalPhotoReaction(latest.state, reaction) })
          }
          Alert.alert(t('photo.reaction.failed'))
          AccessibilityInfo.announceForAccessibility(t('photo.reaction.failed'))
        })
        .finally(() => {
          const latest = snapshotRef.current
          if (latest.key !== key) {
            return
          }
          const nextPending = new Set(latest.pending)
          nextPending.delete(reaction)
          publish({ ...latest, pending: nextPending })
        })
    },
    [gallerySlug, key, photoId, publish, t],
  )

  const current = snapshot.key === key ? snapshot : createSnapshot(key)
  return {
    activeReactions: current.state.activeReactions,
    addReaction,
    counts: current.state.counts,
    pendingReactions: current.pending,
  }
}
