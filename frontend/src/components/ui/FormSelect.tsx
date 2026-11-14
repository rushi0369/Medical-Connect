import type { ComponentPropsWithRef } from 'react'
import { controlClasses, FieldShell, type FieldProps } from './Field'

type FormSelectProps = FieldProps & ComponentPropsWithRef<'select'>

export function FormSelect({ label, error, hint, isOptional, className = '', children, ...selectProps }: FormSelectProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} isOptional={isOptional}>
      {({ id, describedBy, isInvalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className={`h-11 ${controlClasses} ${className}`}
          {...selectProps}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
