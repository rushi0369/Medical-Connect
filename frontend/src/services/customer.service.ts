import type { Invoice, StoreSettingsData } from '../types/invoice'
import type { OrderDetail, OrderSummary, RequestedItem } from '../types/order'
import type { SavedAddress, User } from '../types/user'
import { api } from './api'

export interface SaveAddressInput {
  label?: string
  fullAddress: string
  area: string
  city: string
  state: string
  pincode: string
  deliveryInstructions?: string
  isDefault?: boolean
}

export interface UpdateProfileInput {
  fullName?: string
  email?: string
}

export interface CreateOrderInput {
  addressId: string
  customerInstructions?: string
  requestedItems: RequestedItem[]
  photos?: File[]
}

export interface OrdersListResponse {
  data: OrderSummary[]
  meta: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }
}

export async function fetchCustomerAddresses(): Promise<SavedAddress[]> {
  const response = await api.get<{ success: boolean; data: { addresses: SavedAddress[] } }>('/customers/me/addresses')
  return response.data.data.addresses
}

export async function addCustomerAddress(input: SaveAddressInput): Promise<SavedAddress[]> {
  const response = await api.post<{ success: boolean; data: { addresses: SavedAddress[] } }>('/customers/me/addresses', input)
  return response.data.data.addresses
}

export async function updateCustomerAddress(id: string, input: SaveAddressInput): Promise<SavedAddress[]> {
  const response = await api.patch<{ success: boolean; data: { addresses: SavedAddress[] } }>(`/customers/me/addresses/${id}`, input)
  return response.data.data.addresses
}

export async function deleteCustomerAddress(id: string): Promise<SavedAddress[]> {
  const response = await api.delete<{ success: boolean; data: { addresses: SavedAddress[] } }>(`/customers/me/addresses/${id}`)
  return response.data.data.addresses
}

export async function setDefaultCustomerAddress(id: string): Promise<SavedAddress[]> {
  const response = await api.post<{ success: boolean; data: { addresses: SavedAddress[] } }>(`/customers/me/addresses/${id}/default`)
  return response.data.data.addresses
}

export async function updateCustomerProfile(input: UpdateProfileInput): Promise<User> {
  const response = await api.patch<{ success: boolean; data: { user: User } }>('/customers/me/profile', input)
  return response.data.data.user
}

export async function createMedicineRequest(input: CreateOrderInput): Promise<{ orderId: string; orderNumber: string }> {
  const hasPhotos = input.photos && input.photos.length > 0

  if (hasPhotos) {
    const formData = new FormData()
    formData.append('addressId', input.addressId)
    if (input.customerInstructions) {
      formData.append('customerInstructions', input.customerInstructions)
    }
    formData.append('requestedItems', JSON.stringify(input.requestedItems))
    for (const photo of input.photos!) {
      formData.append('photos', photo)
    }

    const response = await api.post<{
      success: boolean
      data: { orderId: string; orderNumber: string; status: string }
    }>('/customers/me/orders', formData)
    return response.data.data
  }

  const response = await api.post<{
    success: boolean
    data: { orderId: string; orderNumber: string; status: string }
  }>('/customers/me/orders', {
    addressId: input.addressId,
    customerInstructions: input.customerInstructions,
    requestedItems: input.requestedItems,
  })
  return response.data.data
}

export async function fetchCustomerOrders(params?: {
  page?: number
  pageSize?: number
  status?: string
  search?: string
}): Promise<OrdersListResponse> {
  const response = await api.get<OrdersListResponse>('/customers/me/orders', { params })
  return response.data
}

export async function fetchCustomerOrderDetail(id: string): Promise<OrderDetail> {
  const response = await api.get<{ success: boolean; data: { order: OrderDetail } }>(`/customers/me/orders/${id}`)
  return response.data.data.order
}

export async function cancelCustomerOrder(id: string, reason: string): Promise<void> {
  await api.post(`/customers/me/orders/${id}/cancel`, { reason })
}

export async function fetchCustomerInvoices(params?: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<{ data: Invoice[]; meta: { page: number; pageSize: number; totalItems: number; totalPages: number } }> {
  const response = await api.get('/customers/me/invoices', { params })
  return response.data
}

export async function approveCustomerInvoice(
  invoiceId: string,
  payload: { paymentMethod: 'UPI' | 'CASH'; acceptSubstitutes?: boolean },
): Promise<{ orderId: string; invoiceId: string }> {
  const response = await api.post<{ success: boolean; data: { orderId: string; invoiceId: string } }>(
    `/customers/me/invoices/${invoiceId}/approve`,
    payload,
  )
  return response.data.data
}

export async function rejectCustomerInvoice(invoiceId: string, reason: string): Promise<{ orderId: string }> {
  const response = await api.post<{ success: boolean; data: { orderId: string } }>(
    `/customers/me/invoices/${invoiceId}/reject`,
    { reason },
  )
  return response.data.data
}

export async function fetchStoreSettings(): Promise<StoreSettingsData> {
  const response = await api.get<{ success: boolean; data: StoreSettingsData }>('/settings')
  return response.data.data
}


