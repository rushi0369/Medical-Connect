import { Bell } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNotifications } from '../../hooks/useNotifications'
import { IconButton } from '../ui/Button'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const notifications = useNotifications({ pageSize: 5 })
  const { unreadCount } = notifications

  useEffect(() => {
    if (!isOpen) return

    function closeOnOutsideClick(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen])

  return (
    <div ref={container} className="sm:relative">
      <div className="relative">
        <IconButton
          icon={Bell}
          label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 right-1 flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] leading-4.5 font-semibold text-surface"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-x-4 top-16 z-40 max-h-[70dvh] overflow-y-auto rounded-card border border-border bg-surface p-4 shadow-overlay sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-1 sm:w-96">
          <h2 className="mb-2 text-base font-semibold text-text">Notifications</h2>
          <NotificationPanel {...notifications} />
        </div>
      )}
    </div>
  )
}
