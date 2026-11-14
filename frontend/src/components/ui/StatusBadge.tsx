import { CircleAlert, CircleCheck, CircleDot, Clock, Info, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

// Text stays dark for high contrast. Each state also has its own icon, so a state is
// never shown by colour alone.
const TONES: Record<StatusTone, { classes: string; iconClass: string; icon: LucideIcon }> = {
  neutral: { classes: 'bg-surface-muted', iconClass: 'text-primary-dark', icon: CircleDot },
  success: { classes: 'bg-success/15', iconClass: 'text-success', icon: CircleCheck },
  warning: { classes: 'bg-warning/18', iconClass: 'text-warning', icon: Clock },
  danger: { classes: 'bg-danger/14', iconClass: 'text-danger', icon: CircleAlert },
  info: { classes: 'bg-info/15', iconClass: 'text-info', icon: Info },
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  const { classes, iconClass, icon: Icon } = TONES[tone]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-text ${classes}`}>
      <Icon className={`size-3.5 ${iconClass}`} aria-hidden="true" />
      {children}
    </span>
  )
}
