import { Database, Monitor, Server, type LucideIcon } from 'lucide-react'
import type { HealthCheckResult } from '../../types/health'

export type StepState = 'checking' | 'ok' | 'waiting' | 'failed' | 'not-checked'

export interface ConnectionStep {
  id: string
  icon: LucideIcon
  title: string
  technology: string
  state: StepState
  stateLabel: string
  detail: string
}

const BACKEND_FAILURES = {
  unreachable: { stateLabel: 'Not reachable', detail: 'No answer from the backend.' },
  timeout: { stateLabel: 'Timed out', detail: 'The backend took too long to answer.' },
  'invalid-response': {
    stateLabel: 'Unexpected answer',
    detail: 'Something answered, but it is not the CK Medical API.',
  },
}

function backendStep(result: HealthCheckResult | null): ConnectionStep {
  const base = { id: 'backend', icon: Server, title: 'Backend API', technology: 'Express' }

  if (!result) return { ...base, state: 'checking', stateLabel: 'Checking', detail: 'Contacting the backend...' }

  if (result.kind === 'online') {
    return {
      ...base,
      state: 'ok',
      stateLabel: 'Connected',
      detail: `Answered in ${result.responseTimeMs} ms.`,
    }
  }

  return { ...base, state: 'failed', ...BACKEND_FAILURES[result.kind] }
}

function databaseStep(result: HealthCheckResult | null): ConnectionStep {
  const base = { id: 'database', icon: Database, title: 'Database', technology: 'MongoDB' }

  if (!result) return { ...base, state: 'checking', stateLabel: 'Checking', detail: 'Waiting for the backend...' }

  if (result.kind !== 'online') {
    return {
      ...base,
      state: 'not-checked',
      stateLabel: 'Not checked',
      detail: 'Only the backend can check this.',
    }
  }

  switch (result.health.database.status) {
    case 'connected':
      return { ...base, state: 'ok', stateLabel: 'Connected', detail: 'The backend can read and write data.' }
    case 'connecting':
      return { ...base, state: 'waiting', stateLabel: 'Connecting', detail: 'The backend is trying to reach MongoDB.' }
    default:
      return { ...base, state: 'failed', stateLabel: 'Not connected', detail: 'The backend cannot reach MongoDB.' }
  }
}

export function buildConnectionSteps(result: HealthCheckResult | null): ConnectionStep[] {
  return [
    {
      id: 'website',
      icon: Monitor,
      title: 'Website',
      technology: 'React',
      state: 'ok',
      stateLabel: 'Running',
      detail: 'You are viewing it now.',
    },
    backendStep(result),
    databaseStep(result),
  ]
}
