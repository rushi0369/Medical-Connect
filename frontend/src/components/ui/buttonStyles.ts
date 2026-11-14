// Shared with links styled as buttons. min-h-11 (44px) keeps them comfortable to tap.
export const buttonBaseClasses =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export const primaryButtonClasses = `${buttonBaseClasses} bg-primary-dark text-surface hover:bg-text`

export const secondaryButtonClasses = `${buttonBaseClasses} border border-text-muted bg-surface text-text hover:bg-surface-muted`

export const dangerButtonClasses = `${buttonBaseClasses} bg-danger text-surface hover:bg-text`
