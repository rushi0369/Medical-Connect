import { Cross } from 'lucide-react'

interface BrandLogoProps {
  // Use on dark backgrounds, such as the sidebar.
  isOnDark?: boolean
  showTagline?: boolean
}

export function BrandLogo({ isOnDark = false, showTagline = true }: BrandLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-control ${isOnDark ? 'bg-surface text-primary-dark' : 'bg-primary-dark text-surface'}`}
      >
        <Cross className="size-5" fill="currentColor" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className={`block font-heading text-lg leading-tight font-bold ${isOnDark ? 'text-surface' : 'text-text'}`}>
          CK Medical
        </span>
        {showTagline && (
          <span className={`block text-xs ${isOnDark ? 'text-surface-muted' : 'text-text-secondary'}`}>
            Medical Store Management System
          </span>
        )}
      </span>
    </div>
  )
}
