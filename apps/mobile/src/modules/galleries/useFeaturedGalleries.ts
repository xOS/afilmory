import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchFeaturedGalleries } from './api'
import type { FeaturedGallery } from './types'

interface FeaturedGalleriesState {
  galleries: FeaturedGallery[]
  error: Error | null
  loading: boolean
  refreshing: boolean
}

export function useFeaturedGalleries() {
  const [state, setState] = useState<FeaturedGalleriesState>({
    galleries: [],
    error: null,
    loading: true,
    refreshing: false,
  })
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setState(prev => ({
      ...prev,
      error: mode === 'initial' ? null : prev.error,
      loading: mode === 'initial',
      refreshing: mode === 'refresh',
    }))

    try {
      const galleries = await fetchFeaturedGalleries(controller.signal)
      if (controller.signal.aborted) {
        return
      }
      setState({ galleries, error: null, loading: false, refreshing: false })
    }
    catch (error) {
      if (controller.signal.aborted) {
        return
      }
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
        loading: false,
        refreshing: false,
      }))
    }
  }, [])

  useEffect(() => {
    void load('initial')
    return () => {
      controllerRef.current?.abort()
    }
  }, [load])

  const retry = useCallback(() => void load('initial'), [load])
  const refresh = useCallback(() => void load('refresh'), [load])

  return { ...state, refresh, retry }
}
