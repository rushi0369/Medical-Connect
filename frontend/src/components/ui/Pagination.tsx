import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SecondaryButton } from './Button'

interface PaginationProps {
  page: number
  totalPages: number
  totalItems: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, totalItems, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-text-secondary">
        Page {page} of {totalPages} ({totalItems} total)
      </p>
      <div className="flex gap-2">
        <SecondaryButton icon={ChevronLeft} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </SecondaryButton>
        <SecondaryButton icon={ChevronRight} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </SecondaryButton>
      </div>
    </nav>
  )
}
