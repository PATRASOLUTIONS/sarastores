import type { ObjectId } from "mongodb"
import type { GiftAward } from "@/lib/gift-validation"

export interface OrderStatusHistoryEntry {
  status: string
  timestamp: Date | string
  details?: { note?: string; reason?: string }
}

export interface StorePaymentRecord {
  status: "confirmation_pending" | "approved"
  storeId: string
  storeName: string
  storePhone?: string
  storeEmail?: string
  platform: string
  transactionId: string
  submittedAt: Date | string
  approvedAt?: Date | string
  approvedBy?: { id: string; name: string; email: string }
}

export interface OrderDocument {
  _id: ObjectId | string
  orderId?: string
  userId?: string | null
  customerId?: string
  guestAccessTokenHash?: string
  status?: string
  createdAt?: Date | string
  updatedAt?: Date | string
  deliveredAt?: Date
  total?: number
  subtotal?: number
  tax?: number
  shipping?: number
  summary?: { total?: number; subtotal?: number; tax?: number; shipping?: number }
  coupon?: unknown
  items?: unknown[]
  giftPromotions?: GiftAward[]
  customer?: {
    name?: string
    email?: string
    phone?: string
    address?: string | { line1?: string; city?: string; state?: string; pincode?: string; country?: string }
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  shippingAddress?: unknown
  paymentMethod?: string
  paymentDetails?: unknown
  paymentVerification?: {
    verified?: boolean
    verifiedAt?: Date | string
    verifiedBy?: string
    method?: string
    platform?: string
    transactionId?: string
  }
  storePayment?: StorePaymentRecord
  fulfilment?: unknown
  trackingNumber?: string
  tracking?: { trackingNumber?: string; carrier?: string }
  timeline?: Array<{ date: Date | string; status: string; description?: string }>
  statusHistory?: OrderStatusHistoryEntry[]
  notes?: string
  cancellation?: { reason: string; note?: string; date: string; refundStatus?: string }
  partnerId?: string
  partnerOrderId?: string
  commission?: number | { amount?: number }
  licenseKey?: string | null
  licenseKeys?: string[]
  licenseAssignedAt?: Date | string
  licenseFulfillment?: { status: string; updatedAt?: Date | string }
  softwareLicenses?: unknown[]
}
