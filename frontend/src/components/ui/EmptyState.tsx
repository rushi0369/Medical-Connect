import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-muted text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-text">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-text-secondary">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
