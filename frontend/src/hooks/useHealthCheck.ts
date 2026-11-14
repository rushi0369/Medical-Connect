import { useCallback, useEffect, useState } from 'react'
import { checkHealth } from '../services/health.service'
import type { HealthCheckResult } from '../types/health'

export function useHealthCheck() {
  const [result, setResult] = useState<HealthCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    checkHealth(controller.signal).then((nextResult) => {
      if (controller.signal.aborted) return
      setResult(nextResult)
      setIsChecking(false)
    })

    return () => controller.abort()
  }, [attempt])

  const recheck = useCallback(() => {
    setIsChecking(true)
    setAttempt((current) => current + 1)
  }, [])

  return { result, isChecking, recheck }
}
