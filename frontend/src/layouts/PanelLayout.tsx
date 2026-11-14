import { X } from 'lucide-react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router'
import { BottomNav } from '../components/layout/BottomNav'
import { Sidebar, type SidebarTone } from '../components/layout/Sidebar'
import { TopNavbar } from '../components/layout/TopNavbar'
import { IconButton } from '../components/ui/Button'
import { LoadingState } from '../components/ui/LoadingState'
import type { NavItem } from '../routes/navigation'

interface PanelLayoutProps {
  navigation: NavItem[]
  // 'sidebar' for customer and admin. 'bottom' is the rider's phone-first layout.
  mode: 'sidebar' | 'bottom'
  tone: SidebarTone
}

export default function PanelLayout({ navigation, mode, tone }: PanelLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuDialog = useRef<HTMLDialogElement>(null)
  const isSidebarMode = mode === 'sidebar'

  useEffect(() => {
    const dialog = menuDialog.current
    if (!dialog) return
    if (isMenuOpen && !dialog.open) dialog.showModal()
    if (!isMenuOpen && dialog.open) dialog.close()
  }, [isMenuOpen])

  return (
    <div className="min-h-dvh lg:flex bg-background">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-control bg-primary-dark px-4 py-2 text-surface focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar (visible on lg screens for all roles) */}
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 border-r border-border lg:block">
        <Sidebar items={navigation} tone={tone} />
      </aside>

      {/* Mobile Drawer (for Customer and Admin on smaller screens) */}
      {isSidebarMode && (
        <dialog
          ref={menuDialog}
          aria-label="Menu"
          onCancel={(event) => {
            event.preventDefault()
            setIsMenuOpen(false)
          }}
          onClick={(event) => {
            if (event.target === menuDialog.current) setIsMenuOpen(false)
          }}
          className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] overflow-hidden bg-transparent p-0 backdrop:bg-text/50"
        >
          <div className="relative h-full">
            <Sidebar items={navigation} tone={tone} onNavigate={() => setIsMenuOpen(false)} />
            <IconButton
              icon={X}
              label="Close menu"
              tone={tone === 'dark' ? 'onDark' : 'default'}
              onClick={() => setIsMenuOpen(false)}
              className="absolute top-2.5 right-2"
            />
          </div>
        </dialog>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          onOpenMenu={isSidebarMode ? () => setIsMenuOpen(true) : undefined}
          alwaysShowLogo={false}
        />

        <main
          id="main-content"
          className={`flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${
            mode === 'bottom' ? 'pb-24 lg:pb-8' : ''
          }`}
        >
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation (only on mobile for Rider) */}
      {mode === 'bottom' && <BottomNav items={navigation} />}
    </div>
  )
}
