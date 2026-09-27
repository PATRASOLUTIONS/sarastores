interface PaymentDetails {
  method: string
  paymentId?: string
  orderId?: string
  transactionId?: string
  status: string
  cardLast4?: string
}

interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
  category?: string
  color?: string
  size?: string
  type?: 'software' | 'hardware'
  packSize?: number
  validityYears?: number
}

interface Customer {
  firstName: string
  lastName: string
  name: string
  email: string
  phone?: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country: string
}

interface Order {
  id: string
  userId: string
  items: OrderItem[]
  customer: Customer
  total: number
  subtotal: number
  tax: number
  shipping: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  paymentMethod: string
  paymentDetails?: PaymentDetails
  createdAt: string
  updatedAt: string
  trackingNumber?: string
  coupon?: {
    code: string
    name: string
    discount: number
  }
  cancellation?: {
    reason: string
    note: string
    date: string
    refundStatus?: 'pending' | 'processed' | 'declined'
  }
  softwareLicenses?: Array<{
    softwareName: string
    keys: Array<{
      key: string
      validityYears: number
      expiresAt: Date
    }>
  }>
  employeeId?: string
  verifiedEmail?: string
  notes?: string
}