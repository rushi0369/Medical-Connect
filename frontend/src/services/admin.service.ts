import type { Invoice, InvoiceLineItem, StoreSettingsData } from '../types/invoice'
import type { OrderDetail, OrderSummary } from '../types/order'
import type { User } from '../types/user'
import { api } from './api'

export interface SaveReviewNotesInput {
  adminRemarks?: string
  requestedItems?: {
    id: string
    isUnavailable: boolean
    alternativeNote?: string
  }[]
}

export interface SaveInvoiceDraftInput {
  lineItems: InvoiceLineItem[]
  discountPaise?: number
  taxPaise?: number
  deliveryChargePaise?: number
  deliveryDistanceKm?: number | null
  deliveryDurationMinutes?: number | null
  isDeliveryChargeOverridden?: boolean
  remarks?: string
}

export interface AdminCustomerListItem {
  id: string
  fullName: string
  phone: string
  email: string | null
  isActive: boolean
  createdAt: string
  orderCount: number
  lastOrderAt: string | null
}

export interface AdminCustomerDetail {
  customer: User
  orders: (OrderSummary & {
    requestedItems?: { description: string; quantity: number }[]
    lineItems?: { description: string; quantity: number }[]
  })[]
  invoices: Invoice[]
}

export async function fetchAdminOrders(params?: {
  page?: number
  pageSize?: number
  status?: string
  search?: string
}): Promise<{ data: OrderSummary[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const response = await api.get('/admin/orders', { params })
  return response.data
}

export async function fetchAdminOrderDetail(id: string): Promise<OrderDetail> {
  const response = await api.get<{ success: boolean; data: { order: OrderDetail } }>(`/admin/orders/${id}`)
  return response.data.data.order
}

export async function startAdminOrderReview(id: string): Promise<void> {
  await api.post(`/admin/orders/${id}/start-review`)
}

export async function deleteAdminOrder(id: string): Promise<void> {
  await api.delete(`/admin/orders/${id}`)
}

export async function bulkDeleteAdminOrders(orderIds: string[]): Promise<void> {
  await api.post('/admin/orders/bulk-delete', { orderIds })
}

export async function purgeOldAdminOrders(input: {
  days: number
  scope?: 'ALL' | 'COMPLETED' | 'CANCELLED' | 'DELIVERED'
}): Promise<{ deletedOrdersCount: number; freedPhotosCount: number; days: number }> {
  const response = await api.post<{
    success: boolean
    data: { deletedOrdersCount: number; freedPhotosCount: number; days: number }
  }>('/admin/orders/purge', input)
  return response.data.data
}

export async function saveAdminOrderReviewNotes(id: string, input: SaveReviewNotesInput): Promise<void> {
  await api.patch(`/admin/orders/${id}/review-notes`, input)
}

export async function saveAdminInvoiceDraft(orderId: string, input: SaveInvoiceDraftInput): Promise<Invoice> {
  const response = await api.post<{ success: boolean; data: { invoice: Invoice } }>(
    `/admin/orders/${orderId}/invoices/draft`,
    input,
  )
  return response.data.data.invoice
}

export async function sendAdminInvoice(orderId: string): Promise<Invoice> {
  const response = await api.post<{ success: boolean; data: { invoice: Invoice } }>(
    `/admin/orders/${orderId}/invoices/send`,
  )
  return response.data.data.invoice
}

export async function withdrawAdminInvoice(orderId: string): Promise<void> {
  await api.post(`/admin/orders/${orderId}/invoices/withdraw`)
}

export async function approveAdminInvoice(
  invoiceId: string,
  paymentMethod: 'UPI' | 'CASH' = 'UPI',
): Promise<{ orderId: string; invoiceId: string; orderStatus: string }> {
  const response = await api.post<{
    success: boolean
    data: { orderId: string; invoiceId: string; orderStatus: string }
  }>(`/admin/invoices/${invoiceId}/approve`, { paymentMethod })
  return response.data.data
}

export async function fetchAdminInvoices(params?: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<{ data: Invoice[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const response = await api.get('/admin/invoices', { params })
  return response.data
}

export async function deleteAdminInvoice(invoiceId: string): Promise<void> {
  await api.delete(`/admin/invoices/${invoiceId}`)
}

export async function bulkDeleteAdminInvoices(invoiceIds: string[]): Promise<void> {
  await api.post('/admin/invoices/bulk-delete', { invoiceIds })
}

export async function fetchAdminCustomers(params?: {
  page?: number
  pageSize?: number
  search?: string
}): Promise<{ data: AdminCustomerListItem[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const response = await api.get('/admin/customers', { params })
  return response.data
}

export async function fetchAdminCustomerDetail(id: string): Promise<AdminCustomerDetail> {
  const response = await api.get<{ success: boolean; data: AdminCustomerDetail }>(`/admin/customers/${id}`)
  return response.data.data
}

export interface UpdateCustomerInput {
  fullName?: string
  phone?: string
  email?: string | null
  isActive?: boolean
}

export async function updateAdminCustomer(id: string, input: UpdateCustomerInput): Promise<User> {
  const response = await api.patch<{ success: boolean; data: { customer: User } }>(`/admin/customers/${id}`, input)
  return response.data.data.customer
}

export async function deleteAdminCustomer(id: string): Promise<void> {
  await api.delete(`/admin/customers/${id}`)
}

export async function resetAdminCustomerPassword(id: string): Promise<{ customer: User; temporaryPassword: string }> {
  const response = await api.post<{ success: boolean; data: { customer: User; temporaryPassword: string } }>(
    `/admin/customers/${id}/reset-password`
  )
  return response.data.data
}

export async function bulkDeleteAdminCustomers(customerIds: string[]): Promise<void> {
  await api.post('/admin/customers/bulk-delete', { customerIds })
}

export async function fetchStoreSettings(): Promise<StoreSettingsData> {
  const response = await api.get<{ success: boolean; data: StoreSettingsData }>('/settings')
  return response.data.data
}

export async function saveStoreSettings(formData: FormData): Promise<StoreSettingsData> {
  const response = await api.post<{ success: boolean; data: StoreSettingsData }>('/admin/settings', formData)
  return response.data.data
}

export interface DeliveryPricingTier {
  minKm: number
  maxKm: number | null
  chargePaise: number | null
}

export interface DeliveryPricingData {
  isSaved: boolean
  tiers: DeliveryPricingTier[]
  updatedAt: string | null
}

export interface DistanceCalculationResult {
  hasLocations: boolean
  distanceKm: number | null
  durationMinutes: number | null
  chargePaise: number | null
  matchedTier?: DeliveryPricingTier | null
  isEstimated?: boolean
  isRoutingConfigured?: boolean
  message?: string
}

export async function fetchDeliveryPricing(): Promise<DeliveryPricingData> {
  const response = await api.get<{ success: boolean; data: DeliveryPricingData }>('/admin/delivery-pricing')
  return response.data.data
}

export async function saveDeliveryPricing(tiers: DeliveryPricingTier[]): Promise<DeliveryPricingData> {
  const response = await api.post<{ success: boolean; data: DeliveryPricingData }>('/admin/delivery-pricing', { tiers })
  return response.data.data
}

export async function calculateOrderDistance(orderId: string): Promise<DistanceCalculationResult> {
  const response = await api.post<{ success: boolean; data: DistanceCalculationResult }>(
    `/admin/orders/${orderId}/calculate-distance`,
  )
  return response.data.data
}

export interface AvailableRider {
  id: string
  fullName: string
  phone: string
  riderId: string
  activeDeliveries: number
}

export interface AdminDeliveryItem {
  id: string
  orderId: string
  orderNumber: string | null
  orderStatus: string | null
  status: string
  customer: { fullName: string; phone: string } | null
  rider: { id: string; fullName: string; phone: string; riderId: string | null } | null
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
  settlementStatus: string | null
  assignedAt: string
  outForDeliveryAt: string | null
  deliveredAt: string | null
  failedAt: string | null
  failureReason: string | null
  updatedAt: string
}

export async function fetchAdminDeliveries(params?: {
  scope?: string
  status?: string
  riderId?: string
  page?: number
  pageSize?: number
}): Promise<{ data: AdminDeliveryItem[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const response = await api.get('/admin/deliveries', { params })
  return response.data
}

export async function deleteAdminDelivery(id: string): Promise<void> {
  await api.delete(`/admin/deliveries/${id}`)
}

export async function bulkDeleteAdminDeliveries(deliveryIds: string[]): Promise<void> {
  await api.post('/admin/deliveries/bulk-delete', { deliveryIds })
}

export async function fetchAvailableRiders(): Promise<AvailableRider[]> {
  const response = await api.get<{ success: boolean; data: AvailableRider[] }>('/admin/deliveries/available-riders')
  return response.data.data
}

export async function assignRiderToOrder(
  orderId: string,
  riderId: string,
): Promise<{ orderId: string; deliveryId: string; status: string }> {
  const response = await api.post<{ success: boolean; data: { orderId: string; deliveryId: string; status: string } }>(
    `/admin/orders/${orderId}/assign-rider`,
    { riderId },
  )
  return response.data.data
}

export interface AdminPaymentItem {
  id: string
  orderId: string | null
  orderNumber: string | null
  customerName: string | null
  method: 'UPI' | 'CASH'
  status: string
  amountPaise: number
  collectedAmountPaise?: number | null
  collectedAt?: string | null
  collectedBy?: { id: string; fullName: string } | null
  collectedByName?: string | null
  settlementStatus?: string | null
  settledAt?: string | null
  paymentReference?: string | null
  refundReference?: string | null
  refundedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdminPaymentSummary {
  upiVerified: { count: number; amountPaise: number }
  upiPending: { count: number; amountPaise: number }
  cashAwaitingCollection: { count: number; amountPaise: number }
  cashPendingSettlement: { count: number; amountPaise: number }
  cashSettled: { count: number; amountPaise: number }
  refundPending: { count: number; amountPaise: number }
  ridersHoldingCash: {
    riderId: string
    riderName: string
    riderCode: string | null
    amountPaise: number
    count: number
  }[]
  upiAvailable: boolean
}

export async function fetchAdminPayments(params?: {
  page?: number
  pageSize?: number
  status?: string
  method?: string
  settlement?: string
  riderId?: string
}): Promise<{ data: AdminPaymentItem[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const response = await api.get('/admin/payments', { params })
  return response.data
}

export async function fetchAdminPaymentSummary(): Promise<AdminPaymentSummary> {
  const response = await api.get<{ success: boolean; data: AdminPaymentSummary }>('/admin/payments/summary')
  return response.data.data
}

export async function settleCashPayments(paymentIds: string[]): Promise<void> {
  await api.post('/admin/payments/settle-cash', { paymentIds })
}

export async function settleRiderCash(riderId: string): Promise<void> {
  await api.post(`/admin/payments/settle-rider/${riderId}`)
}

export async function recordPaymentRefund(paymentId: string, reference?: string): Promise<void> {
  await api.post(`/admin/payments/${paymentId}/refund`, { reference })
}

export async function updateAdminPayment(paymentId: string, data: any): Promise<void> {
  await api.patch(`/admin/payments/${paymentId}`, data)
}

export async function deleteAdminPayment(paymentId: string): Promise<void> {
  await api.delete(`/admin/payments/${paymentId}`)
}

export async function bulkDeleteAdminPayments(paymentIds: string[]): Promise<void> {
  await api.post('/admin/payments/bulk-delete', { paymentIds })
}

export interface AdminReportData {
  period: { from: string; to: string; groupBy: string }
  timeline: {
    period: string
    orders: number
    delivered: number
    failed: number
    cancelled: number
    revenuePaise: number
  }[]
  totals: {
    orders: number
    delivered: number
    failed: number
    cancelled: number
    revenuePaise: number
  }
  paymentMethods: {
    method: string
    amountPaise: number
    payments: number
  }[]
  riders: {
    riderId: string
    riderName: string
    riderCode: string | null
    assigned: number
    delivered: number
    failed: number
    cashCollectedPaise: number
  }[]
  customers: {
    customerId: string
    customerName: string
    phone: string | null
    orders: number
    delivered: number
    lastOrderAt: string
  }[]
  pendingSettlements: {
    riderId: string
    riderName: string
    amountPaise: number
    payments: number
    oldestCollectedAt: string
  }[]
}

export async function fetchAdminReports(params?: {
  from?: string
  to?: string
  groupBy?: string
}): Promise<AdminReportData> {
  const response = await api.get<{ success: boolean; data: AdminReportData }>('/admin/reports', { params })
  return response.data.data
}
