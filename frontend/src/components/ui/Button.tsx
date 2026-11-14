import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { dangerButtonClasses, primaryButtonClasses, secondaryButtonClasses } from './buttonStyles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  isLoading?: boolean
  children: ReactNode
}

function BaseButton({
  baseClass,
  icon: Icon,
  isLoading = false,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps & { baseClass: string }) {
  return (
    <button
      type={type}
      className={`${baseClass} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? (
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : (
        Icon && <Icon className="size-4" aria-hidden="true" />
      )}
      {children}
    </button>
  )
}

export function PrimaryButton(props: ButtonProps) {
  return <BaseButton baseClass={primaryButtonClasses} {...props} />
}

export function SecondaryButton(props: ButtonProps) {
  return <BaseButton baseClass={secondaryButtonClasses} {...props} />
}

export function DangerButton(props: ButtonProps) {
  return <BaseButton baseClass={dangerButtonClasses} {...props} />
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  // Required because an icon alone says nothing to someone using a screen reader.
  label: string
  tone?: 'default' | 'danger' | 'onDark'
}

const ICON_BUTTON_TONES = {
  default: 'text-text-secondary hover:bg-surface-muted hover:text-text',
  danger: 'text-danger hover:bg-danger/10',
  onDark: 'text-surface hover:bg-surface/15 focus-visible:outline-surface',
}

export function IconButton({ icon: Icon, label, tone = 'default', type = 'button', className = '', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`relative inline-flex size-11 shrink-0 items-center justify-center rounded-control transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${ICON_BUTTON_TONES[tone]} ${className}`}
      {...props}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  )
}
