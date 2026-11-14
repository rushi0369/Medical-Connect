import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router'
import { BrandLogo } from '../../components/common/BrandLogo'
import { primaryButtonClasses } from '../../components/ui/buttonStyles'

export default function ForbiddenPage({ home }: { home: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <BrandLogo />
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <span className="flex size-12 items-center justify-center rounded-full bg-danger/12 text-danger">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-3 text-xl font-bold text-text">You do not have access to this page</h1>
        <p className="mt-2 text-sm text-text-secondary">This area is for a different type of account.</p>
        <Link to={home} className={`${primaryButtonClasses} mt-4`}>
          Go to my dashboard
        </Link>
      </div>
    </main>
  )
}
