import type { DependencyList } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface RemoteResource<T> {
  data: T | null
  error: Error | null
  loading: boolean
  refreshing: boolean
  reload: () => Promise<T | null>
}

export function useRemoteResource<T>(loader: () => Promise<T>, dependencies: DependencyList): RemoteResource<T> {
  const generationRef = useRef(0)
  const dataRef = useRef<T | null>(null)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const reload = useCallback(async () => {
    const generation = ++generationRef.current
    const hasData = dataRef.current !== null
    setError(null)
    setRefreshing(hasData)
    if (!hasData) {
      setLoading(true)
    }

    try {
      const next = await loader()
      if (generation === generationRef.current) {
        dataRef.current = next
        setData(next)
      }
      return next
    }
    catch (cause) {
      if (generation === generationRef.current) {
        setError(cause instanceof Error ? cause : new Error(String(cause)))
      }
      return null
    }
    finally {
      if (generation === generationRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  useEffect(() => {
    void reload()
    return () => {
      generationRef.current += 1
    }
  }, [reload])

  return { data, error, loading, refreshing, reload }
}
