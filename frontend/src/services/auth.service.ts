import type { ApiSuccess } from '../types/api'
import type { User } from '../types/user'
import { api } from './api'

export interface LoginInput {
  identifier: string
  password: string
  rememberMe: boolean
}

export interface RegisterInput {
  fullName: string
  phone: string
  email?: string
  password: string
  address: {
    fullAddress: string
    area: string
    city: string
    state: string
    pincode: string
    deliveryInstructions?: string
  }
}

type UserResponse = ApiSuccess<{ user: User }>

export async function fetchSession() {
  const { data } = await api.get<ApiSuccess<{ user: User | null }>>('/auth/session')
  return data.data.user
}

export async function login(input: LoginInput) {
  const { data } = await api.post<UserResponse>('/auth/login', input)
  return data.data.user
}

export async function register(input: RegisterInput) {
  const { data } = await api.post<UserResponse>('/auth/register', input)
  return data.data.user
}

export async function logout() {
  await api.post('/auth/logout')
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const { data } = await api.post<UserResponse>('/auth/change-password', input)
  return data.data.user
}

export interface RequestResetResult {
  identifier: string
  fullName?: string
  maskedPhone?: string | null
  hasEmail?: boolean
  otp?: string
  whatsappUrl?: string | null
}

export async function requestPasswordReset(identifier: string): Promise<ApiSuccess<RequestResetResult>> {
  const { data } = await api.post<ApiSuccess<RequestResetResult>>('/auth/forgot-password', { identifier })
  return data
}

export async function resetPassword(input: {
  token?: string
  identifier?: string
  otp?: string
  newPassword: string
}) {
  const { data } = await api.post<ApiSuccess<null>>('/auth/reset-password', input)
  return data.message
}
