import { CircleAlert, RefreshCw } from 'lucide-react'
import { SecondaryButton } from './Button'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  fullPage?: boolean
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, fullPage = false }: ErrorStateProps) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center px-4 text-center ${fullPage ? 'min-h-dvh' : 'py-10'}`}>
      <span className="flex size-12 items-center justify-center rounded-full bg-danger/12 text-danger">
        <CircleAlert className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-3 text-base font-semibold text-text">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-text-secondary">{message}</p>
      {onRetry && (
        <SecondaryButton icon={RefreshCw} onClick={onRetry} className="mt-4">
          Try again
        </SecondaryButton>
      )}
    </div>
  )
}
