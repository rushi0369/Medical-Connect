export type Role = 'CUSTOMER' | 'ADMIN' | 'RIDER'

export interface SavedAddress {
  id: string
  label: string
  isDefault: boolean
  fullAddress: string
  area: string
  city: string
  state: string
  pincode: string
  deliveryInstructions: string | null
}

export interface RiderProfile {
  riderId: string
  vehicleNumber: string | null
  notes: string | null
}

export interface User {
  id: string
  fullName: string
  phone: string
  email: string | null
  role: Role
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string
  addresses?: SavedAddress[]
  riderProfile?: RiderProfile
}

export interface Rider extends User {
  riderProfile: RiderProfile
}

export interface RiderListItem extends Rider {
  deliveryStats: { assigned: number; completed: number }
}
