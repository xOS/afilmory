import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchGalleryManifest } from './api'
import type { GalleryPhoto } from './types'

interface GalleryManifestState {
  photos: GalleryPhoto[]
  error: Error | null
  loading: boolean
}

export function useGalleryManifest(slug: string) {
  const [state, setState] = useState<GalleryManifestState>({
    photos: [],
    error: null,
    loading: true,
  })
  const [refreshing, setRefreshing] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState({ photos: [], error: null, loading: true })

    try {
      const photos = await fetchGalleryManifest(slug, controller.signal)
      if (controller.signal.aborted) {
        return
      }
      setState({ photos, error: null, loading: false })
    }
    catch (error) {
      if (controller.signal.aborted) {
        return
      }
      setState({
        photos: [],
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
      })
    }
  }, [slug])

  useEffect(() => {
    void load()
    return () => {
      controllerRef.current?.abort()
    }
  }, [load])

  const retry = useCallback(() => void load(), [load])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      const photos = await fetchGalleryManifest(slug)
      setState(prev => ({ ...prev, photos, error: null }))
    }
    catch {
      // keep showing the current photos on a failed refresh
    }
    finally {
      setRefreshing(false)
    }
  }, [slug])

  return { ...state, refresh, refreshing, retry }
}
