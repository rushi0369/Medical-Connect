import { LogOut, Menu } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { ROLE_LABEL, ROLE_PROFILE } from '../../routes/navigation'
import { getErrorMessage } from '../../utils/apiError'
import { initialsOf } from '../../utils/format'
import { BrandLogo } from '../common/BrandLogo'
import { NotificationBell } from '../common/NotificationBell'
import { IconButton } from '../ui/Button'

interface TopNavbarProps {
  // Shown below the desktop width, where the sidebar becomes a pop-out menu.
  onOpenMenu?: () => void
  alwaysShowLogo?: boolean
}

export function TopNavbar({ onOpenMenu, alwaysShowLogo = false }: TopNavbarProps) {
  const { user, logout } = useAuth()
  const showToast = useToast()
  const navigate = useNavigate()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (!user) return null

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      showToast(getErrorMessage(error), 'error')
      setIsLoggingOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4 lg:px-6">
      {onOpenMenu && <IconButton icon={Menu} label="Open menu" onClick={onOpenMenu} className="lg:hidden" />}

      <div className={alwaysShowLogo ? 'min-w-0' : 'min-w-0 lg:hidden'}>
        <BrandLogo showTagline={false} />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <NotificationBell />

        <Link
          to={ROLE_PROFILE[user.role]}
          aria-label={`${user.fullName}, open profile`}
          className="flex items-center gap-2 rounded-control p-1 hover:bg-surface-muted"
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted font-heading text-sm font-bold text-primary-dark"
          >
            {initialsOf(user.fullName)}
          </span>
          <span className="hidden max-w-40 min-w-0 pr-1 md:block">
            <span className="block truncate text-sm font-semibold text-text">{user.fullName}</span>
            <span className="block text-xs text-text-secondary">{ROLE_LABEL[user.role]}</span>
          </span>
        </Link>

        <IconButton icon={LogOut} label="Log out" onClick={handleLogout} disabled={isLoggingOut} />
      </div>
    </header>
  )
}
