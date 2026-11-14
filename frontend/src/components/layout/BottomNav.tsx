import { NavLink } from 'react-router'
import type { NavItem } from '../../routes/navigation'

/** The rider's main menu: large, thumb-reachable, and only showing screens that exist. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Main menu"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface shadow-overlay lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-center justify-around px-1">
        {items
          .filter((item) => item.to)
          .map((item) => (
            <li key={item.label} className="flex-1">
              <NavLink
                to={item.to as string}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 py-1.5 transition-colors ${
                    isActive ? 'font-semibold text-primary-dark' : 'text-text-secondary hover:text-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                        isActive ? 'bg-primary-subtle text-primary' : ''
                      }`}
                    >
                      <item.icon className="size-5 shrink-0" aria-hidden="true" />
                    </span>
                    <span className="truncate text-center w-full px-0.5 text-[11px] leading-tight">
                      {item.shortLabel || item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
      </ul>
    </nav>
  )
}
