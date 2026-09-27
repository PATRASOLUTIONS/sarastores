/** Shapes returned by the Sara Electronics API, mirrored from the server types. */

export interface ProductDisplay {
  mrp: number
  price: number
  discountPercent: number
  rating: number
  reviewCount: number
  inStock: boolean
  badge: { label: string; tone: "sale" | "new" | "best" } | null
  benefits: string[]
  emi: {
    available: boolean
    tenureMonths: number
    perMonth: number
    lowestPerMonth: number | null
    lowestIssuer: string | null
  }
}

export interface Product {
  id: string
  slug?: string
  name: string
  price: number
  mrp?: number
  image?: string
  images?: string[]
  stock?: number
  category?: string
  subCategory?: string
  brand?: string
  sku?: string
  description?: string
  /** Present only when the request sets `display=1`. */
  display?: ProductDisplay
}

export interface CartItem {
  productId: string
  id: string
  name: string
  price: number
  quantity: number
  image?: string
}

export interface Cart {
  userId: string
  items: CartItem[]
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  emailVerified: boolean
  avatar: string | null
  phone: string | null
  address: string | null
}

export interface TokenPair {
  tokenType: "Bearer"
  accessToken: string
  expiresIn: number
  refreshToken: string
  refreshExpiresAt: string
  user: AuthUser
}

export interface Category {
  id: string
  name: string
  image?: string
  isEnabled?: boolean
}

export interface Order {
  id: string
  orderId: string
  status: string
  total: number
  createdAt: string
  items: CartItem[]
}
