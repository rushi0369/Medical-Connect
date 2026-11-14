import {
  Bell,
  Bike,
  ChartColumn,
  ClipboardList,
  CreditCard,
  History,
  House,
  LayoutDashboard,
  MapPin,
  Pill,
  Receipt,
  Route,
  Settings,
  Tag,
  Truck,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../types/user'

export interface NavItem {
  label: string
  shortLabel?: string
  icon: LucideIcon
  // No "to" means the screen is not built yet. It shows as disabled, tagged with its phase.
  to?: string
  phase?: number
  end?: boolean
}

export const CUSTOMER_NAVIGATION: NavItem[] = [
  { label: 'Dashboard', icon: House, to: '/customer', end: true },
  { label: 'Request Medicines', icon: Pill, to: '/customer/requests/new' },
  { label: 'My Orders', icon: ClipboardList, to: '/customer/orders' },
  { label: 'My Bills', icon: Receipt, to: '/customer/bills' },
  { label: 'Payment History', icon: CreditCard, to: '/customer/bills' },
  { label: 'Delivery Tracking', icon: Route, to: '/customer/orders' },
  { label: 'Saved Addresses', icon: MapPin, to: '/customer/addresses' },
  { label: 'Notifications', icon: Bell, to: '/customer/notifications' },
  { label: 'My Profile', icon: UserRound, to: '/customer/profile' },
]

export const ADMIN_NAVIGATION: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/admin', end: true },
  { label: 'Customer Management', icon: Users, to: '/admin/customers' },
  { label: 'Order Requests', icon: ClipboardList, to: '/admin/orders' },
  { label: 'Billing & Invoices', icon: Receipt, to: '/admin/invoices' },
  { label: 'Rider Management', icon: Bike, to: '/admin/riders' },
  { label: 'Delivery Management', icon: Truck, to: '/admin/deliveries' },
  { label: 'Payments & Settlements', icon: CreditCard, to: '/admin/payments' },
  { label: 'Delivery Pricing', icon: Tag, to: '/admin/delivery-pricing' },
  { label: 'Reports & Analytics', icon: ChartColumn, to: '/admin/reports' },
  { label: 'Notifications', icon: Bell, to: '/admin/notifications' },
  { label: 'Settings & Store QR', icon: Settings, to: '/admin/settings' },
]

export const RIDER_NAVIGATION: NavItem[] = [
  { label: 'Dashboard', shortLabel: 'Home', icon: House, to: '/rider', end: true },
  { label: 'Assigned Deliveries', shortLabel: 'Orders', icon: ClipboardList, to: '/rider/deliveries' },
  { label: 'Delivery History', shortLabel: 'History', icon: History, to: '/rider/history' },
  { label: 'Notifications', shortLabel: 'Alerts', icon: Bell, to: '/rider/notifications' },
  { label: 'My Profile', shortLabel: 'Profile', icon: UserRound, to: '/rider/profile' },
]

export const ROLE_HOME: Record<Role, string> = {
  CUSTOMER: '/customer',
  ADMIN: '/admin',
  RIDER: '/rider',
}

export const ROLE_PROFILE: Record<Role, string> = {
  CUSTOMER: '/customer/profile',
  ADMIN: '/admin/settings',
  RIDER: '/rider/profile',
}

export const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Customer',
  ADMIN: 'Administrator',
  RIDER: 'Rider',
}
