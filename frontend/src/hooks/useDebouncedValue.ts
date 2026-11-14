import { useEffect, useState } from 'react'

/** Waits for typing to pause, so a search does not call the server on every keystroke. */
export function useDebouncedValue<Value>(value: Value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
