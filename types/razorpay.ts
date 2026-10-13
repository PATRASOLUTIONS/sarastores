import type { LiveRazorpayOffer } from "@/lib/razorpay-offers"
import { z } from "zod"

export interface RazorpayCheckoutResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayCheckoutResponse) => void | Promise<void>
  prefill: { name: string; email: string; contact: string }
  notes: Record<string, string>
  theme: { color: string }
  config?: {
    display: {
      blocks: Record<string, { name: string; instruments: Array<{ method: string }> }>
      sequence: string[]
      preferences: { show_default_blocks: boolean }
    }
  }
  modal: { ondismiss: () => void }
}

export const RazorpayOrderResponseSchema = z.object({
  keyId: z.string().min(1),
  orderId: z.string().min(1),
  checkoutToken: z.string().min(1),
  amount: z.coerce.number().int().positive(),
  currency: z.literal("INR"),
})

export const RazorpayVerificationResponseSchema = z.object({
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
})

export type RazorpayOffer = LiveRazorpayOffer

export interface RazorpayOffersResponse {
  items: RazorpayOffer[]
  count: number
  source: 'razorpay'
}

// Bank color mapping for UI
export const BANK_COLORS: Record<string, { from: string; to: string; badge: string }> = {
  HDFC: { from: 'from-blue-50', to: 'to-blue-100', badge: 'bg-blue-600' },
  ICICI: { from: 'from-purple-50', to: 'to-purple-100', badge: 'bg-purple-600' },
  AXIS: { from: 'from-orange-50', to: 'to-orange-100', badge: 'bg-orange-600' },
  SBI: { from: 'from-green-50', to: 'to-green-100', badge: 'bg-green-600' },
  KOTAK: { from: 'from-red-50', to: 'to-red-100', badge: 'bg-red-600' },
  PAYTM: { from: 'from-indigo-50', to: 'to-indigo-100', badge: 'bg-indigo-600' },
  PHONEPE: { from: 'from-violet-50', to: 'to-violet-100', badge: 'bg-violet-600' },
  GPAY: { from: 'from-teal-50', to: 'to-teal-100', badge: 'bg-teal-600' },
  'AMAZON PAY': { from: 'from-yellow-50', to: 'to-yellow-100', badge: 'bg-yellow-600' },
  BANK: { from: 'from-gray-50', to: 'to-gray-100', badge: 'bg-gray-600' },
}

// Get border color based on bank
export const getBorderColor = (bank: string): string => {
  const colorMap: Record<string, string> = {
    HDFC: 'border-blue-200',
    ICICI: 'border-purple-200',
    AXIS: 'border-orange-200',
    SBI: 'border-green-200',
    KOTAK: 'border-red-200',
    PAYTM: 'border-indigo-200',
    PHONEPE: 'border-violet-200',
    GPAY: 'border-teal-200',
    'AMAZON PAY': 'border-yellow-200',
    BANK: 'border-gray-200',
  }
  return colorMap[bank] || 'border-gray-200'
}
