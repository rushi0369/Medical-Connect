import { LoaderCircle } from 'lucide-react'
import { StatusBadge, type StatusTone } from '../../components/ui/StatusBadge'
import type { ConnectionStep, StepState } from './connectionSteps'

const STATE_TONES: Record<Exclude<StepState, 'checking'>, StatusTone> = {
  ok: 'success',
  waiting: 'warning',
  failed: 'danger',
  'not-checked': 'neutral',
}

export function ConnectionStepList({ steps }: { steps: ConnectionStep[] }) {
  return (
    <ol>
      {steps.map(({ id, icon: StepIcon, title, technology, state, stateLabel, detail }) => (
        <li key={id} className="group relative flex gap-4 pb-6 last:pb-0">
          {/* The line joining each step shows that every link depends on the one before it. */}
          <span className="absolute top-10 bottom-0 left-5 w-px bg-border group-last:hidden" aria-hidden="true" />
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-muted text-primary-dark">
            <StepIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="text-sm font-semibold text-text">
                {title} <span className="font-normal text-text-secondary">({technology})</span>
              </h2>
              {state === 'checking' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-text">
                  <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  {stateLabel}
                </span>
              ) : (
                <StatusBadge tone={STATE_TONES[state]}>{stateLabel}</StatusBadge>
              )}
            </div>
            <p className="mt-1 text-sm text-text-secondary">{detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
