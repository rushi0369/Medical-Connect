import type { ApiSuccess, PageMeta } from '../types/api'
import type { Rider, RiderListItem } from '../types/user'
import { api } from './api'

export type RiderStatusFilter = 'all' | 'active' | 'inactive'

export interface RiderInput {
  fullName: string
  phone: string
  email: string
  vehicleNumber: string
  notes: string
}

export async function fetchRiders(
  params: { page: number; pageSize: number; search: string; status: RiderStatusFilter },
  signal: AbortSignal,
) {
  const { data } = await api.get<ApiSuccess<RiderListItem[], PageMeta>>('/riders', { params, signal })
  return { riders: data.data, meta: data.meta }
}

export async function fetchRider(id: string, signal: AbortSignal) {
  const { data } = await api.get<ApiSuccess<{ rider: Rider }>>(`/riders/${id}`, { signal })
  return data.data.rider
}

export async function createRider(input: RiderInput) {
  const { data } = await api.post<ApiSuccess<{ rider: Rider; temporaryPassword: string }>>('/riders', input)
  return data.data
}

export async function updateRider(id: string, input: RiderInput) {
  const { data } = await api.patch<ApiSuccess<{ rider: Rider }>>(`/riders/${id}`, input)
  return data.data.rider
}

export async function setRiderActive(id: string, isActive: boolean) {
  const { data } = await api.patch<ApiSuccess<{ rider: Rider }>>(`/riders/${id}/status`, { isActive })
  return data
}

export async function resetRiderCredentials(id: string) {
  const { data } = await api.post<ApiSuccess<{ rider: Rider; temporaryPassword: string }>>(
    `/riders/${id}/reset-credentials`,
  )
  return data.data
}

// Rider Delivery Types & APIs
export type DeliveryAction = 'start' | 'reach' | 'deliver' | 'fail'
export type DeliveryFailureReason =
  | 'CUSTOMER_UNAVAILABLE'
  | 'INCORRECT_ADDRESS'
  | 'CUSTOMER_REFUSED'
  | 'UNABLE_TO_CONTACT'
  | 'OTHER'

export interface RiderDeliveryItem {
  id: string
  orderId: string
  orderNumber: string
  orderStatus: string
  status: string
  customer: { fullName: string; phone: string } | null
  address: {
    fullAddress: string
    area: string
    city: string
    state: string
    pincode: string
    location?: { lat: number; lng: number } | null
    deliveryInstructions?: string | null
  } | null
  amountPaise: number | null
  paymentMethod: string | null
  paymentStatus: string | null
  updatedAt: string
}

export interface RiderDeliveryDetailData {
  delivery: {
    id: string
    orderId: string
    status: string
    assignedAt: string
    outForDeliveryAt: string | null
    reachedAt: string | null
    deliveredAt: string | null
    failedAt: string | null
    failureReason: string | null
    failureNotes: string | null
  }
  order: {
    id: string
    orderNumber: string
    status: string
    address: {
      fullAddress: string
      area: string
      city: string
      state: string
      pincode: string
      location?: { lat: number; lng: number } | null
      deliveryInstructions?: string | null
    }
    customerInstructions: string | null
  }
  customer: { fullName: string; phone: string }
  items: { id: string; description: string; quantity: number }[]
  grandTotalPaise: number | null
  payment: {
    id: string
    method: 'CASH' | 'UPI'
    status: string
    amountPaise: number
    collectedAmountPaise: number | null
  } | null
  allowedActions: {
    canStart?: boolean
    canReach?: boolean
    canDeliver?: boolean
    canFail?: boolean
    canCollectCash?: boolean
    canConfirmOnline?: boolean
    canCheckPayment?: boolean
  }
}

export async function fetchMyDeliveries(params?: {
  scope?: 'active' | 'history'
  page?: number
  pageSize?: number
}): Promise<{ data: RiderDeliveryItem[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const response = await api.get('/riders/me/deliveries', { params })
  return response.data
}

export async function fetchRiderDeliveryDetail(id: string): Promise<RiderDeliveryDetailData> {
  const response = await api.get<{ success: boolean; data: RiderDeliveryDetailData }>(`/riders/me/deliveries/${id}`)
  return response.data.data
}

export async function updateRiderDeliveryAction(
  id: string,
  payload: { action: DeliveryAction; reason?: DeliveryFailureReason; notes?: string },
): Promise<void> {
  await api.post(`/riders/me/deliveries/${id}/action`, payload)
}

export async function recordRiderCashCollection(id: string, amountPaise: number): Promise<void> {
  await api.post(`/riders/me/deliveries/${id}/collect-cash`, { amountPaise })
}

export async function confirmRiderOnlinePayment(id: string): Promise<void> {
  await api.post(`/riders/me/deliveries/${id}/confirm-online`)
}

export async function deleteRider(id: string): Promise<void> {
  await api.delete(`/riders/${id}`)
}

export async function bulkDeleteRiders(riderIds: string[]): Promise<void> {
  await api.post('/riders/bulk-delete', { riderIds })
}
