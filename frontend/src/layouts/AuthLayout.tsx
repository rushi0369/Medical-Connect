import { Camera, ClipboardCheck, Truck } from 'lucide-react'
import { Outlet } from 'react-router'
import { BrandLogo } from '../components/common/BrandLogo'

const HOW_IT_WORKS = [
  {
    icon: Camera,
    title: 'Send your request',
    text: 'Upload a photo of your prescription or medicine, or type what you need.',
  },
  {
    icon: ClipboardCheck,
    title: 'Approve your bill',
    text: 'The store checks availability in person and sends you a bill to approve.',
  },
  {
    icon: Truck,
    title: 'Get it delivered',
    text: 'A rider brings your medicines to your door, and you can follow each step.',
  },
]

/** Shared by login, sign-up and password screens. There is no role choice anywhere here. */
export default function AuthLayout() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-primary-dark p-10 text-surface lg:flex xl:p-14">
        <BrandLogo isOnDark />
        <div>
          <h2 className="max-w-md text-3xl leading-tight font-bold">Your medical store, a request away.</h2>
          <ul className="mt-8 space-y-6">
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface/12 text-primary-light">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-heading font-semibold">{title}</span>
                  <span className="mt-0.5 block text-sm text-surface-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <span />
      </aside>

      <main className="flex min-h-dvh flex-col items-center px-4 py-8 sm:justify-center sm:py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <BrandLogo />
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
