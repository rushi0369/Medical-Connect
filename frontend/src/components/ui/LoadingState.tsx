import { LoaderCircle } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  fullPage?: boolean
}

export function LoadingState({ label = 'Loading...', fullPage = false }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-sm text-text-secondary ${fullPage ? 'min-h-dvh' : 'py-12'}`}
    >
      <LoaderCircle className="size-5 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
      {label}
    </div>
  )
}
