import { Search, X } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  className?: string
}

export function SearchBar({ value, onChange, label, placeholder, className = '' }: SearchBarProps) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute top-3 left-3 size-5 text-text-muted" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className="h-11 w-full rounded-control border border-text-muted bg-surface pr-10 pl-10 text-sm text-text [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute top-1 right-1 flex size-9 items-center justify-center rounded-control text-text-secondary hover:bg-surface-muted"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
