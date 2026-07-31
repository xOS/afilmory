import { useCallback, useEffect, useRef, useState } from 'react'

import { commentsApi } from './api'
import {
  emptyCommentCollection,
  mergeCommentPage,
  removeOptimisticComment,
  replaceComment,
  settleOptimisticComment,
  toggleLocalReaction,
} from './commentState'
import type { CommentCollection, CommentUser, PhotoComment } from './types'

const PAGE_SIZE = 20

export interface PhotoCommentsResource {
  collection: CommentCollection
  create: (input: CreatePhotoCommentInput) => Promise<PhotoComment>
  error: Error | null
  loadMore: () => Promise<void>
  loading: boolean
  loadingMore: boolean
  nextCursor: string | null
  reactionBusyIds: ReadonlySet<string>
  refresh: () => Promise<void>
  refreshing: boolean
  submitting: boolean
  toggleReaction: (commentId: string) => Promise<void>
}

export interface CreatePhotoCommentInput {
  clientId: string
  content: string
  parentId: string | null
  user: CommentUser
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function usePhotoComments(gallerySlug: string, photoId: string, viewerId: string | null): PhotoCommentsResource {
  const [collection, setCollection] = useState<CommentCollection>(() => emptyCommentCollection())
  const collectionRef = useRef(collection)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [reactionBusyIds, setReactionBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const reactionBusyRef = useRef(new Set<string>())
  const loadingMoreRef = useRef(false)
  const generationRef = useRef(0)
  const viewerRef = useRef(viewerId)
  viewerRef.current = viewerId
  const initialRequestRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  const commitCollection = useCallback((updater: (current: CommentCollection) => CommentCollection) => {
    setCollection((current) => {
      const next = updater(current)
      collectionRef.current = next
      return next
    })
  }, [])

  const loadFirstPage = useCallback(
    async (isRefresh: boolean) => {
      const generation = ++generationRef.current
      const requestViewerId = viewerId
      initialRequestRef.current?.abort()
      const controller = new AbortController()
      initialRequestRef.current = controller
      setError(null)
      setRefreshing(isRefresh)
      setLoading(!isRefresh)

      try {
        const page = await commentsApi.list({ gallerySlug, limit: PAGE_SIZE, photoId, signal: controller.signal })
        if (
          generation !== generationRef.current
          || controller.signal.aborted
          || requestViewerId !== viewerRef.current
        ) {
          return
        }
        commitCollection(current => mergeCommentPage(current, page, true))
        setNextCursor(page.nextCursor)
      }
      catch (cause) {
        if (generation === generationRef.current && !controller.signal.aborted) {
          setError(asError(cause))
        }
      }
      finally {
        if (generation === generationRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [commitCollection, gallerySlug, photoId, viewerId],
  )

  useEffect(() => {
    mountedRef.current = true
    collectionRef.current = emptyCommentCollection()
    setCollection(collectionRef.current)
    setNextCursor(null)
    loadingMoreRef.current = false
    setLoadingMore(false)
    reactionBusyRef.current.clear()
    setReactionBusyIds(new Set())
    void loadFirstPage(false)
    return () => {
      mountedRef.current = false
      generationRef.current += 1
      initialRequestRef.current?.abort()
    }
  }, [loadFirstPage])

  const refresh = useCallback(async () => {
    await loadFirstPage(true)
  }, [loadFirstPage])

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) {
      return
    }
    loadingMoreRef.current = true
    const generation = generationRef.current
    setLoadingMore(true)
    setError(null)
    try {
      const page = await commentsApi.list({ cursor: nextCursor, gallerySlug, limit: PAGE_SIZE, photoId })
      if (!mountedRef.current || generation !== generationRef.current) {
        return
      }
      commitCollection(current => mergeCommentPage(current, page))
      setNextCursor(page.nextCursor)
    }
    catch (cause) {
      if (mountedRef.current && generation === generationRef.current) {
        setError(asError(cause))
      }
    }
    finally {
      if (generation === generationRef.current) {
        loadingMoreRef.current = false
      }
      if (mountedRef.current && generation === generationRef.current) {
        setLoadingMore(false)
      }
    }
  }, [commitCollection, gallerySlug, nextCursor, photoId])

  const create = useCallback(
    async ({ clientId, content, parentId, user }: CreatePhotoCommentInput) => {
      const now = new Date().toISOString()
      const optimisticComment: PhotoComment = {
        clientId,
        content,
        createdAt: now,
        deliveryState: 'sending',
        id: clientId,
        parentId,
        photoId,
        reactionCounts: {},
        status: 'pending',
        updatedAt: now,
        userId: user.id,
        viewerReactions: [],
      }
      setSubmitting(true)
      commitCollection((current) => {
        const parent = parentId
          ? (current.comments.find(comment => comment.id === parentId) ?? current.relations[parentId])
          : null
        return mergeCommentPage(current, {
          comments: [optimisticComment],
          relations: parent ? { [parent.id]: parent } : {},
          users: { [user.id]: user },
        })
      })
      try {
        const result = await commentsApi.create({ content, gallerySlug, parentId, photoId })
        const created = result.comments[0]
        if (!created) {
          throw new Error('The comment response did not include the created comment.')
        }
        const settled = { ...created, clientId, deliveryState: 'sent' as const }
        if (mountedRef.current) {
          commitCollection(current => settleOptimisticComment(current, clientId, result))
        }
        return settled
      }
      catch (cause) {
        if (mountedRef.current) {
          commitCollection(current => removeOptimisticComment(current, clientId))
        }
        throw cause
      }
      finally {
        if (mountedRef.current) {
          setSubmitting(false)
        }
      }
    },
    [commitCollection, gallerySlug, photoId],
  )

  const toggleReaction = useCallback(
    async (commentId: string) => {
      if (reactionBusyRef.current.has(commentId)) {
        return
      }
      const original = collectionRef.current.comments.find(comment => comment.id === commentId)
      if (!original) {
        return
      }

      reactionBusyRef.current.add(commentId)
      setReactionBusyIds(new Set(reactionBusyRef.current))
      commitCollection(current => replaceComment(current, toggleLocalReaction(original)))
      try {
        const serverComment = await commentsApi.toggleReaction({ commentId, gallerySlug })
        if (mountedRef.current) {
          commitCollection(current => replaceComment(current, serverComment))
        }
      }
      catch (cause) {
        if (mountedRef.current) {
          commitCollection(current => replaceComment(current, original))
        }
        throw cause
      }
      finally {
        reactionBusyRef.current.delete(commentId)
        if (mountedRef.current) {
          setReactionBusyIds(new Set(reactionBusyRef.current))
        }
      }
    },
    [commitCollection, gallerySlug],
  )

  return {
    collection,
    create,
    error,
    loadMore,
    loading,
    loadingMore,
    nextCursor,
    reactionBusyIds,
    refresh,
    refreshing,
    submitting,
    toggleReaction,
  }
}
