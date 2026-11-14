import type { StatusTone } from '../components/ui/StatusBadge'
import type { OrderStatus } from '../types/dashboard'

export const ORDER_STATUS_DISPLAY: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  PENDING_ADMIN_REVIEW: { label: 'Waiting for store', tone: 'info' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  WAITING_FOR_CUSTOMER_APPROVAL: { label: 'Bill needs approval', tone: 'warning' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  RIDER_ASSIGNED: { label: 'Rider assigned', tone: 'info' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', tone: 'info' },
  REACHED_CUSTOMER: { label: 'Rider has arrived', tone: 'info' },
  DELIVERED: { label: 'Delivered', tone: 'success' },
  DELIVERY_FAILED: { label: 'Delivery failed', tone: 'danger' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
}
