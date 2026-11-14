import { z } from 'zod'

const healthDataSchema = z.object({
  service: z.literal('medicare-api'),
  status: z.enum(['ok', 'degraded']),
  database: z.object({
    status: z.enum(['connected', 'connecting', 'disconnected', 'disconnecting']),
  }),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
})

export const healthResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: healthDataSchema,
})

export type HealthData = z.infer<typeof healthDataSchema>

export type HealthCheckResult =
  | { kind: 'online'; health: HealthData; responseTimeMs: number; checkedAt: Date }
  // Nothing answered, or the browser blocked the answer (CORS).
  | { kind: 'unreachable'; checkedAt: Date }
  | { kind: 'timeout'; checkedAt: Date }
  // Something answered, but it is not the MediCare API.
  | { kind: 'invalid-response'; checkedAt: Date }
