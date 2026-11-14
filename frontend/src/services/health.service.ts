import axios from 'axios'
import { healthResponseSchema, type HealthCheckResult } from '../types/health'
import { api } from './api'

/** Asks the backend for its status. Reports failures as a result rather than throwing. */
export async function checkHealth(signal: AbortSignal): Promise<HealthCheckResult> {
  const startedAt = performance.now()

  try {
    const response = await api.get<unknown>('/health', { signal })
    const parsed = healthResponseSchema.safeParse(response.data)

    if (!parsed.success) return { kind: 'invalid-response', checkedAt: new Date() }

    return {
      kind: 'online',
      health: parsed.data.data,
      responseTimeMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date(),
    }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') return { kind: 'timeout', checkedAt: new Date() }
      if (error.response) return { kind: 'invalid-response', checkedAt: new Date() }
    }
    return { kind: 'unreachable', checkedAt: new Date() }
  }
}
