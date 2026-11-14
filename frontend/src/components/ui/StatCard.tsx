import type { LucideIcon } from 'lucide-react'

const ICON_TONES = {
  neutral: 'bg-surface-muted text-primary-dark',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
}

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  hint?: string
  tone?: keyof typeof ICON_TONES
  // Stacks the icon above the text, for narrow two-column phone layouts.
  isStacked?: boolean
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'neutral', isStacked = false }: StatCardProps) {
  return (
    <div
      className={`flex gap-3 rounded-card border border-border bg-surface p-4 shadow-card sm:p-5 ${isStacked ? 'flex-col' : 'items-start'}`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-control ${ICON_TONES[tone]}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        <p className="mt-0.5 font-heading text-2xl leading-tight font-bold text-text tabular-nums">{value}</p>
        {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
      </div>
    </div>
  )
}
