export type InvoiceStatus = 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'REVISED'

export interface InvoiceLineItem {
  id?: string
  description: string
  quantity: number
  unitPricePaise: number
  lineTotalPaise?: number
  isSubstitute?: boolean
  substituteFor?: string | null
}

export interface Invoice {
  id: string
  orderId: string
  orderNumber?: string
  orderStatus?: string
  currentRider?: string
  customerName?: string
  customerPhone?: string
  version: number
  status: InvoiceStatus
  lineItems: InvoiceLineItem[]
  subtotalPaise: number
  discountPaise: number
  taxPaise: number
  deliveryChargePaise: number
  grandTotalPaise: number
  deliveryDistanceKm: number | null
  deliveryDurationMinutes: number | null
  isDeliveryChargeOverridden: boolean
  remarks: string | null
  rejectionReason: string | null
  createdAt: string
  sentAt: string | null
  approvedAt: string | null
  rejectedAt: string | null
}

export interface StoreSettingsData {
  isSaved: boolean
  storeName: string
  contactPhone: string | null
  upiId: string | null
  upiQrUrl: string | null
  address: {
    fullAddress: string
    area: string
    city: string
    state: string
    pincode: string
    location?: { lat: number; lng: number } | null
  } | null
  updatedAt: string | null
}

