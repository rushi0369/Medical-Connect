import type { ReactNode } from 'react'

interface DashboardCardProps {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}

export function DashboardCard({ title, description, action, className = '', children }: DashboardCardProps) {
  return (
    <section className={`rounded-card border border-border bg-surface p-5 shadow-card sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-text">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}
