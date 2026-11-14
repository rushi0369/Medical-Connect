import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState } from '../components/ui/ErrorState'
import { LoadingState } from '../components/ui/LoadingState'
import { useAuth } from '../hooks/useAuth'
import ForbiddenPage from '../pages/system/ForbiddenPage'
import type { Role } from '../types/user'
import { ROLE_HOME } from './navigation'

const SERVER_UNAVAILABLE_MESSAGE = 'We cannot reach the server right now. Please check your connection and try again.'

// These guards decide which screens to show. They are a convenience, not the protection:
// the backend checks the login and role again on every request.

export function RequireRole({ role }: { role: Role }) {
  const { user, status, retrySession } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingState fullPage />
  if (status === 'unavailable') return <ErrorState fullPage message={SERVER_UNAVAILABLE_MESSAGE} onRetry={retrySession} />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />
  if (user.role !== role) return <ForbiddenPage home={ROLE_HOME[user.role]} />

  return <Outlet />
}

/** For the forced password change: any logged-in role can open it. */
export function RequireLogin() {
  const { user, status, retrySession } = useAuth()

  if (status === 'loading') return <LoadingState fullPage />
  if (status === 'unavailable') return <ErrorState fullPage message={SERVER_UNAVAILABLE_MESSAGE} onRetry={retrySession} />
  if (!user) return <Navigate to="/login" replace />

  return <Outlet />
}

/** Login and sign-up pages: someone already logged in goes to their own dashboard. */
export function GuestOnly() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingState fullPage />

  if (user) {
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />

    // Return to the page they first asked for, but only if it is in their own panel.
    const home = ROLE_HOME[user.role]
    const requested = (location.state as { from?: string } | null)?.from
    return <Navigate to={requested?.startsWith(home) ? requested : home} replace />
  }

  return <Outlet />
}

/** The site's front door. */
export function HomeRedirect() {
  const { user, status, retrySession } = useAuth()

  if (status === 'loading') return <LoadingState fullPage />
  if (status === 'unavailable') return <ErrorState fullPage message={SERVER_UNAVAILABLE_MESSAGE} onRetry={retrySession} />
  if (!user) return <Navigate to="/login" replace />

  return <Navigate to={user.mustChangePassword ? '/change-password' : ROLE_HOME[user.role]} replace />
}
