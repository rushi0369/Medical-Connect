export type OrderStatus =
  | 'PENDING_ADMIN_REVIEW'
  | 'UNDER_REVIEW'
  | 'WAITING_FOR_CUSTOMER_APPROVAL'
  | 'CONFIRMED'
  | 'RIDER_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'REACHED_CUSTOMER'
  | 'DELIVERED'
  | 'DELIVERY_FAILED'
  | 'CANCELLED'

export interface AdminSummary {
  totalCustomers: number
  totalOrders: number
  newRequests: number
  underReview: number
  awaitingApproval: number
  activeRiders: number
  inactiveRiders: number
  assignedDeliveries: number
  deliveredOrders: number
  failedDeliveries: number
  todayRevenuePaise: number
  pendingPayments: number
}

export interface RecentOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
}

export interface CustomerSummary {
  totalOrders: number
  activeOrders: number
  pendingApprovals: number
  completedDeliveries: number
  recentOrders: RecentOrder[]
}

export interface RiderSummary {
  assignedDeliveries: number
  pendingDeliveries: number
  outForDelivery: number
  completedDeliveries: number
  failedDeliveries: number
  cashCollectedPaise: number
  cashSettlementPendingPaise: number
}

export interface AppNotification {
  id: string
  type: string
  title: string
  message: string
  orderId: string | null
  isRead: boolean
  createdAt: string
}
