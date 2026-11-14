import { Link } from 'react-router'
import { BrandLogo } from '../../components/common/BrandLogo'
import { primaryButtonClasses } from '../../components/ui/buttonStyles'

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <BrandLogo />
      <div className="rounded-card border border-border bg-surface p-6 shadow-card">
        <h1 className="text-xl font-bold text-text">Page not found</h1>
        <p className="mt-2 text-sm text-text-secondary">The address you opened does not match any page in CK Medical.</p>
        <Link to="/" className={`${primaryButtonClasses} mt-4`}>
          Go to the home page
        </Link>
      </div>
    </main>
  )
}
