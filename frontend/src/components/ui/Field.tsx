import { useId, type ReactNode } from 'react'

export const controlClasses =
  'w-full rounded-control border bg-surface px-3 text-sm text-text aria-invalid:border-danger disabled:bg-surface-muted border-text-muted'

export interface FieldProps {
  label: string
  error?: string
  hint?: string
  isOptional?: boolean
}

interface FieldShellProps extends FieldProps {
  children: (ids: { id: string; describedBy: string | undefined; isInvalid: boolean }) => ReactNode
}

/** The label, hint and error shared by every form control, correctly linked for screen readers. */
export function FieldShell({ label, error, hint, isOptional = false, children }: FieldShellProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-text">
        {label}
        {isOptional && <span className="font-normal text-text-secondary"> (optional)</span>}
      </label>
      {children({ id, describedBy, isInvalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
