import { api } from "@/api/client"
import type { Cart, Category, Order, Product } from "@/api/types"

/** `display=1` asks the server for MRP, discount, rating, badge and EMI so the
 *  app never recomputes them and can never disagree with the website. */
const DISPLAY = "display=1"

export async function fetchProducts(params: {
  limit?: number
  skip?: number
  category?: string
  search?: string
  featured?: boolean
} = {}): Promise<Product[]> {
  const query = new URLSearchParams({ fields: "card", display: "1" })
  if (params.limit) query.set("limit", String(params.limit))
  if (params.skip) query.set("skip", String(params.skip))
  if (params.category) query.set("category", params.category)
  if (params.search) query.set("search", params.search)
  if (params.featured) query.set("featured", "true")
  return api.get<Product[]>(`/api/products?${query.toString()}`)
}

export async function fetchProduct(slugOrId: string): Promise<Product> {
  return api.get<Product>(`/api/products/${encodeURIComponent(slugOrId)}?${DISPLAY}`)
}

/** Grouped technical specs for the PDP. Absent for many SKUs, so callers must tolerate null. */
export async function fetchSpecifications(sku: string): Promise<Record<string, unknown> | null> {
  try {
    return await api.get<Record<string, unknown>>(`/api/products/specifications/${encodeURIComponent(sku)}`)
  } catch {
    return null
  }
}

export async function fetchReviews(productId: string): Promise<
  { id: string; rating: number; comment?: string; userName?: string; createdAt?: string }[]
> {
  try {
    return await api.get(`/api/reviews?productId=${encodeURIComponent(productId)}`)
  } catch {
    return []
  }
}

export async function fetchCategories(): Promise<Category[]> {
  return api.get<Category[]>("/api/categories")
}

export async function searchSuggestions(term: string): Promise<Product[]> {
  return fetchProducts({ search: term, limit: 8 })
}

export async function fetchCart(): Promise<Cart> {
  return api.get<Cart>("/api/cart", { auth: true })
}

export async function saveCart(items: Cart["items"]): Promise<void> {
  await api.post("/api/cart", { items }, { auth: true })
}

export async function fetchWishlist(): Promise<{ items: Product[] }> {
  return api.get<{ items: Product[] }>("/api/wishlist", { auth: true })
}

export async function toggleWishlist(productId: string): Promise<void> {
  await api.post("/api/wishlist", { productId }, { auth: true })
}

export async function fetchOrders(): Promise<Order[]> {
  return api.get<Order[]>("/api/orders", { auth: true })
}

export async function fetchOrder(orderId: string): Promise<Order> {
  return api.get<Order>(`/api/orders/${encodeURIComponent(orderId)}`, { auth: true })
}

export interface Brand {
  name: string
  slug?: string
  logo?: string
  tagline?: string
  description?: string
  categories?: { title: string; description?: string; url?: string }[]
  features?: { icon?: string; text: string }[]
  whyChoose?: { heading?: string; subtitle?: string; reasons?: { title: string; description?: string }[] }
  heroContent?: { title?: string; subtitle?: string; description?: string }
  productsSection?: { heading?: string; subtitle?: string; manufacturerFilter?: string; maxProducts?: number }
}

export async function fetchBrands(): Promise<Brand[]> {
  const res = await api.get<{ brands?: Brand[] } | Brand[]>("/api/brands")
  return Array.isArray(res) ? res : (res.brands ?? [])
}

export async function fetchBrand(slug: string): Promise<Brand | null> {
  try {
    const res = await api.get<{ brand?: Brand }>(`/api/brands?slug=${encodeURIComponent(slug)}`)
    return res.brand ?? null
  } catch {
    return null
  }
}

export interface Offer {
  id: string
  name: string
  description?: string
  image?: string
  badge?: string
  originalPrice?: number
  offerPrice?: number
  discount?: number
  stock?: number
  endsAt?: string
}

export async function fetchOffers(section: string): Promise<Offer[]> {
  try {
    const res = await api.get<{ offers?: Offer[] } | Offer[]>(
      `/api/offers?section=${encodeURIComponent(section)}&live=true`,
    )
    return Array.isArray(res) ? res : (res.offers ?? [])
  } catch {
    return []
  }
}

export interface Store {
  id?: string
  name: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  region?: string
  phone?: string
  email?: string
  hours?: string
  image?: string
  mapUrl?: string
  latitude?: number
  longitude?: number
}

export async function fetchStores(): Promise<Store[]> {
  const res = await api.get<{ stores?: Store[]; data?: Store[] } | Store[]>("/api/stores")
  if (Array.isArray(res)) return res
  return res.stores ?? res.data ?? []
}

export interface SubCategory {
  id?: string
  name: string
  slug?: string
  image?: string
  category?: string
  productCount?: number
}

export async function fetchSubCategories(): Promise<SubCategory[]> {
  try {
    const res = await api.get<{ subCategories?: SubCategory[]; data?: SubCategory[] } | SubCategory[]>(
      "/api/sub-categories",
    )
    if (Array.isArray(res)) return res
    return res.subCategories ?? res.data ?? []
  } catch {
    return []
  }
}

/** Compare uses a bulk lookup so six products cost one request. */
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return []
  const res = await api.post<Product[] | { products?: Product[] }>("/api/products/bulk", { ids, compare: true })
  return Array.isArray(res) ? res : (res.products ?? [])
}
