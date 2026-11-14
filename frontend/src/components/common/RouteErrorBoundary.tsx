import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useRouteError } from 'react-router'
import { PrimaryButton, SecondaryButton } from '../ui/Button'

export function RouteErrorBoundary() {
  const error: any = useRouteError()

  const isChunkError =
    error?.message?.includes?.('dynamically imported module') ||
    error?.message?.includes?.('Loading chunk') ||
    error?.toString?.()?.includes?.('dynamically imported module')

  function handleReload() {
    window.location.reload()
  }

  function handleHome() {
    window.location.href = '/'
  }

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="rounded-2xl border border-border bg-surface p-8 max-w-md w-full shadow-card space-y-4">
        <div className="size-12 rounded-full bg-danger-subtle text-danger flex items-center justify-center mx-auto">
          <AlertTriangle className="size-6" />
        </div>

        <div>
          <h2 className="text-lg font-heading font-bold text-text">
            {isChunkError ? 'New Update Loaded' : 'Page Encountered a Glitch'}
          </h2>
          <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
            {isChunkError
              ? 'The system has been updated. Please refresh the page to load the latest changes.'
              : error?.message || 'An unexpected error occurred while loading this section.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <PrimaryButton onClick={handleReload} icon={RefreshCw} className="w-full sm:w-auto text-xs">
            Refresh Page
          </PrimaryButton>
          <SecondaryButton onClick={handleHome} className="w-full sm:w-auto text-xs">
            Back to Dashboard
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}

