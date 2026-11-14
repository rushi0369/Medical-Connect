import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'

interface FormAlertProps {
  tone?: 'error' | 'success'
  children: ReactNode
}

export function FormAlert({ tone = 'error', children }: FormAlertProps) {
  const isError = tone === 'error'
  const Icon = isError ? CircleAlert : CircleCheck

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-control p-3 text-sm text-text ${isError ? 'bg-danger/12' : 'bg-success/15'}`}
    >
      <Icon className={`mt-0.5 size-4 shrink-0 ${isError ? 'text-danger' : 'text-success'}`} aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
