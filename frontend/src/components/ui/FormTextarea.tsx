import type { ComponentPropsWithRef } from 'react'
import { controlClasses, FieldShell, type FieldProps } from './Field'

type FormTextareaProps = FieldProps & ComponentPropsWithRef<'textarea'>

export function FormTextarea({ label, error, hint, isOptional, rows = 3, ...textareaProps }: FormTextareaProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} isOptional={isOptional}>
      {({ id, describedBy, isInvalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className={`py-2 ${controlClasses}`}
          {...textareaProps}
        />
      )}
    </FieldShell>
  )
}
