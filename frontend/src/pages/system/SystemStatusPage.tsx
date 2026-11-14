import { RefreshCw } from 'lucide-react'
import { BrandLogo } from '../../components/common/BrandLogo'
import { SecondaryButton } from '../../components/ui/Button'
import { useHealthCheck } from '../../hooks/useHealthCheck'
import type { HealthCheckResult } from '../../types/health'
import { ConnectionStepList } from './ConnectionStepList'
import { buildConnectionSteps } from './connectionSteps'
import { TroubleshootingPanel } from './TroubleshootingPanel'

function summarize(result: HealthCheckResult | null) {
  if (!result) return 'Checking the connection...'
  if (result.kind !== 'online') return 'The backend is not available.'
  if (result.health.status === 'ok') return 'Everything is connected.'
  return 'The backend is running, but the database is not connected.'
}

/** A diagnostic page at /status, for checking that every part of the system is connected. */
export default function SystemStatusPage() {
  const { result, isChecking, recheck } = useHealthCheck()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-4 py-8">
      <BrandLogo />

      <div className="rounded-card border border-border bg-surface p-5 shadow-card sm:p-6">
        <h1 className="text-xl font-bold text-text">System status</h1>
        <p className="mt-1 mb-6 text-sm text-text-secondary" role="status">
          {summarize(result)}
        </p>

        <ConnectionStepList steps={buildConnectionSteps(result)} />

        {/* Setup instructions are for developers, so they are left out of production builds. */}
        {result && import.meta.env.DEV && <TroubleshootingPanel result={result} />}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-text-secondary">
            {result ? `Last checked at ${result.checkedAt.toLocaleTimeString()}` : 'First check in progress'}
          </p>
          <SecondaryButton icon={RefreshCw} onClick={recheck} isLoading={isChecking}>
            {isChecking ? 'Checking...' : 'Check again'}
          </SecondaryButton>
        </div>
      </div>
    </main>
  )
}
