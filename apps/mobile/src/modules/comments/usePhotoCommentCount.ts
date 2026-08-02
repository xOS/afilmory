import { useCallback, useEffect, useRef, useState } from 'react'

import { commentsApi } from './api'

export function usePhotoCommentCount(gallerySlug: string | null, photoId: string | null) {
  const [value, setValue] = useState<{ count: number | null, key: string | null }>({ count: null, key: null })
  const requestRef = useRef<AbortController | null>(null)
  const key = gallerySlug && photoId ? `${gallerySlug}:${photoId}` : null

  const refresh = useCallback(async () => {
    requestRef.current?.abort()
    if (!gallerySlug || !photoId) {
      setValue({ count: null, key: null })
      return
    }
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const count = await commentsApi.count(gallerySlug, photoId, controller.signal)
      if (!controller.signal.aborted) {
        setValue({ count, key: `${gallerySlug}:${photoId}` })
      }
    }
    catch {
      if (!controller.signal.aborted) {
        setValue({ count: null, key: `${gallerySlug}:${photoId}` })
      }
    }
  }, [gallerySlug, photoId])

  const setCount = useCallback(
    (count: number) => {
      if (!gallerySlug || !photoId) {
        return
      }
      setValue({ count: Math.max(0, count), key: `${gallerySlug}:${photoId}` })
    },
    [gallerySlug, photoId],
  )

  useEffect(() => {
    void refresh()
    return () => requestRef.current?.abort()
  }, [refresh])

  return { count: value.key === key ? value.count : null, refresh, setCount }
}
