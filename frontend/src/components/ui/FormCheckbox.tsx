import { useId, type ComponentPropsWithRef } from 'react'

type FormCheckboxProps = { label: string } & Omit<ComponentPropsWithRef<'input'>, 'type'>

export function FormCheckbox({ label, ...inputProps }: FormCheckboxProps) {
  const id = useId()

  return (
    <div className="flex min-h-11 items-center gap-2">
      <input id={id} type="checkbox" className="size-4.5 accent-primary-dark" {...inputProps} />
      <label htmlFor={id} className="text-sm text-text">
        {label}
      </label>
    </div>
  )
}
