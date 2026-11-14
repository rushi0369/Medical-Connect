import type { ComponentPropsWithRef } from 'react'
import { controlClasses, FieldShell, type FieldProps } from './Field'

type FormInputProps = FieldProps & ComponentPropsWithRef<'input'>

export function FormInput({ label, error, hint, isOptional, className = '', ...inputProps }: FormInputProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} isOptional={isOptional}>
      {({ id, describedBy, isInvalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className={`h-11 ${controlClasses} ${className}`}
          {...inputProps}
        />
      )}
    </FieldShell>
  )
}
