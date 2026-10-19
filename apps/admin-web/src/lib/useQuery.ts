import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './supabase'

export function useQuery<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps)

  const reload = useCallback(async () => {
    const id = ++requestId.current
    try {
      const result = await run()
      if (id !== requestId.current) return
      setData(result)
      setError(null)
    } catch (err) {
      if (id !== requestId.current) return
      setError(errorMessage(err, 'Unable to load data.'))
    }
  }, [run])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, error, reload, loading: data === null && error === null }
}
