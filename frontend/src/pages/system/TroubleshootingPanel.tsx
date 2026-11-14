import type { ReactNode } from 'react'
import { api } from '../../services/api'
import type { HealthCheckResult } from '../../types/health'

function Command({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-control border border-border bg-surface px-3 py-2 font-mono text-xs text-text">
      {children}
    </pre>
  )
}

function Inline({ children }: { children: ReactNode }) {
  return <code className="rounded bg-surface px-1 py-0.5 font-mono text-xs wrap-anywhere">{children}</code>
}

function advice(result: HealthCheckResult): { title: string; body: ReactNode } | null {
  const apiUrl = api.defaults.baseURL ?? '(VITE_API_URL is not set)'

  switch (result.kind) {
    case 'unreachable':
    case 'timeout':
      return {
        title: 'The website cannot reach the backend',
        body: (
          <>
            <p>
              It tried <Inline>{apiUrl}</Inline>. The backend is probably not running. Start it in its own PowerShell
              window:
            </p>
            <Command>{'cd backend\nnpm run dev'}</Command>
            <p className="mt-2">
              If it is already running, check that <Inline>CLIENT_URL</Inline> in <Inline>backend/.env</Inline> matches
              this page's address exactly (<Inline>{window.location.origin}</Inline>). Browsers treat{' '}
              <Inline>localhost</Inline> and <Inline>127.0.0.1</Inline> as different sites.
            </p>
          </>
        ),
      }
    case 'invalid-response':
      return {
        title: 'The API address looks wrong',
        body: (
          <p>
            Something answered at <Inline>{apiUrl}</Inline>, but it is not the CK Medical API. Check{' '}
            <Inline>VITE_API_URL</Inline> in <Inline>frontend/.env</Inline>, then restart the frontend.
          </p>
        ),
      }
    case 'online':
      if (result.health.database.status === 'connected') return null
      return {
        title: 'The database is not connected yet',
        body: (
          <p>
            Check <Inline>MONGODB_URI</Inline> in <Inline>backend/.env</Inline>. If you changed it, restart the backend.
            For a plain-language diagnosis, run <Inline>npm run db:check</Inline> in the <Inline>backend</Inline> folder.
            For a temporary network problem, the backend keeps retrying by itself, so just press Check again in a few
            seconds.
          </p>
        ),
      }
  }
}

export function TroubleshootingPanel({ result }: { result: HealthCheckResult }) {
  const content = advice(result)
  if (!content) return null

  return (
    <section className="mt-6 rounded-control bg-surface-muted p-4 text-sm text-text">
      <h2 className="font-semibold text-text">{content.title}</h2>
      <div className="mt-2">{content.body}</div>
    </section>
  )
}
