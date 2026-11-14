import type { OrderStatus } from './dashboard'

export interface RequestedItem {
  id?: string
  description: string
  quantity: number
  notes?: string | null
  isUnavailable?: boolean
  alternativeNote?: string | null
}

export interface RequestPhoto {
  id: string
  name: string | null
}

export interface OrderAddress {
  fullAddress: string
  area: string
  city: string
  state: string
  pincode: string
  location?: { lat: number; lng: number } | null
  deliveryInstructions?: string | null
}

export interface StatusHistoryEntry {
  status: OrderStatus
  actorRole: string
  note: string | null
  at: string
}

export interface OrderSummary {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  customer?: { id: string; fullName: string; phone: string } | null
  photoCount: number
  itemCount: number
  grandTotalPaise: number | null
  paymentMethod: string | null
  paymentStatus: string | null
  riderName: string | null
}

export interface OrderDetail {
  id: string
  orderNumber: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  customer?: { id: string; fullName: string; phone: string; email?: string | null } | null
  address: OrderAddress
  photos: RequestPhoto[]
  requestedItems: RequestedItem[]
  customerInstructions: string | null
  adminRemarks: string | null
  statusHistory: StatusHistoryEntry[]
  invoice?: any | null
  payment?: any | null
  delivery?: any | null
  cancellation?: { reason: string | null; byRole: string; at: string } | null
  allowedActions: {
    canCancel: boolean
    canRespondToInvoice?: boolean
    canChangePaymentMethod?: boolean
    canPayByUpi?: boolean
    canCheckPayment?: boolean
    canReorder?: boolean
    canStartReview?: boolean
    canEditReview?: boolean
    canEditBill?: boolean
    canSendInvoice?: boolean
    canWithdrawInvoice?: boolean
    canAssignRider?: boolean
    canReassignRider?: boolean
  }
}

