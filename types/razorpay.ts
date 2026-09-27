export interface RazorpayOffer {
  id: string
  name: string
  description: string
  bank: string
  discount_percentage: number | null
  discount_amount: number | null
  min_amount: number | null
  max_discount: number | null
  payment_method: string
  active: boolean
  starts_at?: number
  ends_at?: number
  type: 'instant' | 'emi' | 'cashback'
}

export interface RazorpayOffersResponse {
  items: RazorpayOffer[]
  count: number
  source: 'razorpay' | 'fallback'
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
