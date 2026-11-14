import type { ApiSuccess } from '../types/api'
import type { AdminSummary, CustomerSummary, RiderSummary } from '../types/dashboard'
import { api } from './api'

export async function fetchAdminSummary(signal: AbortSignal) {
  const { data } = await api.get<ApiSuccess<AdminSummary>>('/admin/summary', { signal })
  return data.data
}

export async function fetchCustomerSummary(signal: AbortSignal) {
  const { data } = await api.get<ApiSuccess<CustomerSummary>>('/customers/me/summary', { signal })
  return data.data
}

export async function fetchRiderSummary(signal: AbortSignal) {
  const { data } = await api.get<ApiSuccess<RiderSummary>>('/riders/me/summary', { signal })
  return data.data
}
