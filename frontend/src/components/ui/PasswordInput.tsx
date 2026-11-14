import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentPropsWithRef } from 'react'
import { controlClasses, FieldShell, type FieldProps } from './Field'

type PasswordInputProps = FieldProps & Omit<ComponentPropsWithRef<'input'>, 'type'>

export function PasswordInput({ label, error, hint, isOptional, ...inputProps }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <FieldShell label={label} error={error} hint={hint} isOptional={isOptional}>
      {({ id, describedBy, isInvalid }) => (
        <div className="relative">
          <input
            id={id}
            type={isVisible ? 'text' : 'password'}
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
            className={`h-11 pr-11 ${controlClasses}`}
            {...inputProps}
          />
          <button
            type="button"
            onClick={() => setIsVisible((current) => !current)}
            aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
            aria-pressed={isVisible}
            className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-control text-text-secondary hover:text-text"
          >
            {isVisible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>
      )}
    </FieldShell>
  )
}
