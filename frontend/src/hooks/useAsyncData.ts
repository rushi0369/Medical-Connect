/* oxlint-disable react-hooks/exhaustive-deps -- like useEffect, the caller lists what the load depends on. */
import { useCallback, useEffect, useState, type DependencyList } from 'react'

interface AsyncState<Data> {
  data: Data | null
  error: unknown
  isLoading: boolean
}

/**
 * Loads data when a page opens and whenever a dependency changes. Earlier requests
 * are cancelled, so a slow old answer can never overwrite a newer one.
 */
export function useAsyncData<Data>(load: (signal: AbortSignal) => Promise<Data>, dependencies: DependencyList) {
  const [state, setState] = useState<AsyncState<Data>>({ data: null, error: null, isLoading: true })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: null, isLoading: false })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState((current) => ({ ...current, error, isLoading: false }))
      })

    return () => controller.abort()
  }, [...dependencies, attempt])

  const reload = useCallback(() => {
    setState((current) => ({ ...current, error: null, isLoading: true }))
    setAttempt((current) => current + 1)
  }, [])

  return { ...state, reload }
}
