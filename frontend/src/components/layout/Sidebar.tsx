import { NavLink } from 'react-router'
import type { NavItem } from '../../routes/navigation'
import { BrandLogo } from '../common/BrandLogo'

export type SidebarTone = 'dark' | 'light'

const TONES = {
  dark: {
    shell: 'bg-primary-dark',
    link: 'text-surface hover:bg-surface/10 focus-visible:outline-surface',
    active: 'bg-surface/15 font-semibold before:bg-primary-light',
    disabled: 'text-primary-light',
    tag: 'border-primary-light/50 text-primary-light',
  },
  light: {
    shell: 'border-r border-border bg-surface',
    link: 'text-text hover:bg-background',
    active: 'bg-surface-muted font-semibold before:bg-primary',
    disabled: 'text-text-muted',
    tag: 'border-border text-text-muted',
  },
}

interface SidebarProps {
  items: NavItem[]
  tone: SidebarTone
  onNavigate?: () => void
}

export function Sidebar({ items, tone, onNavigate }: SidebarProps) {
  const styles = TONES[tone]

  return (
    <div className={`flex h-full flex-col ${styles.shell}`}>
      <div className="flex h-16 shrink-0 items-center px-5">
        <BrandLogo isOnDark={tone === 'dark'} showTagline={false} />
      </div>
      <nav aria-label="Main menu" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.label}>
              {item.to ? (
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `relative flex min-h-11 items-center gap-3 rounded-control px-3 text-sm before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full ${styles.link} ${isActive ? styles.active : 'before:bg-transparent'}`
                  }
                >
                  <item.icon className="size-5 shrink-0" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ) : (
                <span
                  aria-disabled="true"
                  className={`flex min-h-11 cursor-not-allowed items-center gap-3 rounded-control px-3 text-sm ${styles.disabled}`}
                >
                  <item.icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  <span className={`shrink-0 rounded border px-1.5 text-[0.6875rem] leading-5 ${styles.tag}`}>
                    Phase {item.phase}
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
