import { apiFetch } from "@/lib/api-client"
import { normalizeProductForSchema } from "@/lib/product-schema"

export interface AdminProductResponse {
  id: string
  slug?: string
  sku?: string
  itemno?: string
  name?: string
  description?: string
  price?: number | string
  mrp?: number
  stock?: number | string
  image?: string
  images?: string[]
  category?: string
  groupName?: string
  itemCategory?: string
  manufacturerName?: string
  manufacturer_name?: string
  color?: string
  subCategory?: string
  prod_desc?: string
  capacity?: string
  ean?: string
  active?: boolean
  trusted?: boolean
  updatedAt?: string
  raw?: {
    "Item No."?: string
    "Old Item Model"?: string
    Manufacturer?: string
    "Manufacturer Name"?: string
    Color?: string
    "Capacity Description"?: string
    "EAN Number"?: string
    "Tax Category"?: string
    "ITEM CATEGORY"?: string
    [key: string]: unknown
  }
}

let inFlight: Promise<AdminProductResponse[]> | null = null

async function loadPages(metadata: boolean): Promise<AdminProductResponse[]> {
  const products: AdminProductResponse[] = []
  const ids = new Set<string>()
  let expectedTotal: number | undefined
  while (true) {
    const params = new URLSearchParams({
      include_inactive: "true",
      fields: metadata ? "admin-metadata" : "admin",
      limit: "100",
      skip: String(products.length),
    })
    const response = await apiFetch(`/api/products?${params}`, { cache: "no-store" })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to fetch products")
    }
    const data: AdminProductResponse[] = await response.json()
    if (!Array.isArray(data) || data.some(product => !product || typeof product.id !== "string" || !product.id)) {
      throw new Error("Invalid products response")
    }
    const totalHeader = response.headers.get("X-Total-Count")
    const hasMore = response.headers.get("X-Has-More")
    const total = totalHeader === null || !/^\d+$/.test(totalHeader) ? NaN : Number(totalHeader)
    if (!Number.isSafeInteger(total) || (hasMore !== "true" && hasMore !== "false")) {
      throw new Error("Product pagination information is missing or invalid; reload the page")
    }
    if (expectedTotal !== undefined && total !== expectedTotal) {
      throw new Error("The catalogue changed while loading; reload the page")
    }
    expectedTotal = total
    for (const product of data) {
      if (ids.has(product.id)) throw new Error("The catalogue changed while loading; reload the page")
      ids.add(product.id)
      products.push(product)
    }
    if (hasMore === "false") {
      if (products.length !== total) throw new Error("The product list is incomplete; reload the page")
      return products
    }
    if (!data.length || products.length >= total) throw new Error("Product pagination made no progress; reload the page")
  }
}

export function fetchAllAdminProducts(metadata = false): Promise<AdminProductResponse[]> {
  if (metadata) return loadPages(true)
  if (!inFlight) inFlight = loadPages(false).finally(() => { inFlight = null })
  return inFlight
}

export function buildActiveProductPriceSheet(products: AdminProductResponse[]) {
  const activeProducts = products.filter(product => product.active === true)
  if (!activeProducts.length) throw new Error("There are no customer-visible products to download")
  const seen = new Set<string>()
  return activeProducts.map(product => {
    const itemno = normalizeProductForSchema(product).itemno
    if (!itemno) throw new Error(`Product ${product.name || product.id} has no item number; correct it in Products before exporting`)
    if (seen.has(itemno)) throw new Error(`Multiple active products use itemno ${itemno}; reconcile them before exporting`)
    seen.add(itemno)
    return {
      itemno,
      price: product.price ?? "",
      mrp: product.mrp ?? "",
      stock: product.stock ?? "",
      active: "active",
    }
  })
}
