import { ObjectId } from "mongodb"
import { COLLECTIONS, getCollection } from "@/lib/db-service"

// Catalogue prices are GST-inclusive; base and tax are derived from them.
const GST_RATE = 0.18
const DEFAULT_SHIPPING_FEE = 99
const DEFAULT_FREE_SHIPPING_THRESHOLD = 1000
const MAX_QUANTITY_PER_ITEM = 20

export type IncomingItem = {
  id?: string
  productId?: string
  sku?: string | null
  quantity?: number | string
  type?: string | null
  // The cart sends explicit nulls for non-integration items and numbers for the
  // software fields, so the accepted shape is wider than the stored one.
  provider?: string | null
  source?: string | null
  kgenProductId?: string | null
  externalProductId?: string | null
  kgenVariantId?: string | null
  externalVariantId?: string | null
  packSize?: string | number | null
  validityYears?: string | number | null
  maxDevices?: string | number | null
  validity?: string | null
  color?: string | null
  size?: string | null
}

export type PricedItem = {
  id: string
  name: string
  price: number
  quantity: number
  image: string | null
  category: string | null
  subCategory: string | null
  type: string
  provider: string | null
  source: string | null
  kgenProductId: string | null
  kgenVariantId: string | null
  packSize: string | null
  validityYears: string | null
  maxDevices: string | null
  validity: string | null
  color: string | null
  size: string | null
}

export type PricingSuccess = {
  ok: true
  items: PricedItem[]
  subtotal: number
  tax: number
  shipping: number
  gross: number
  couponDiscount: number
  coupon: { code: string; name: string; discount: number } | null
  total: number
}

export type PricingResult = PricingSuccess | { ok: false; error: string }

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Software metadata arrives as either a string or a number from the cart. */
function toText(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

function keysFor(item: IncomingItem): string[] {
  return [item.id, item.productId, item.kgenProductId, item.externalProductId, item.sku]
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
}

function idMatchQuery(keys: string[]) {
  const objectIds = keys.filter((k) => ObjectId.isValid(k)).map((k) => new ObjectId(k))
  const or: Record<string, unknown>[] = [{ id: { $in: keys } }, { sku: { $in: keys } }, { _id: { $in: keys } }]
  if (objectIds.length) or.push({ _id: { $in: objectIds } })
  return { $or: or }
}

function docKeys(doc: Record<string, any>): string[] {
  return [doc.id, doc._id?.toString?.(), doc.sku].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  )
}

async function loadCatalogue(items: IncomingItem[]) {
  const allKeys = [...new Set(items.flatMap(keysFor))]
  if (allKeys.length === 0) return new Map<string, Record<string, any>>()

  const [products, software] = await Promise.all([
    getCollection(COLLECTIONS.PRODUCTS).then((c) => c.find(idMatchQuery(allKeys)).toArray()),
    getCollection("software_products").then((c) => c.find(idMatchQuery(allKeys)).toArray()),
  ])

  const byKey = new Map<string, Record<string, any>>()
  for (const doc of [...products, ...software]) {
    for (const k of docKeys(doc)) if (!byKey.has(k)) byKey.set(k, doc)
  }
  return byKey
}

async function getShippingSettings() {
  try {
    const settings = await getCollection("settings")
    const doc = await settings.findOne({}, { projection: { shippingFee: 1, freeShippingThreshold: 1 } })
    return {
      shippingFee: Number(doc?.shippingFee ?? DEFAULT_SHIPPING_FEE),
      freeShippingThreshold: Number(doc?.freeShippingThreshold ?? DEFAULT_FREE_SHIPPING_THRESHOLD),
    }
  } catch {
    return { shippingFee: DEFAULT_SHIPPING_FEE, freeShippingThreshold: DEFAULT_FREE_SHIPPING_THRESHOLD }
  }
}

type ApplyScope = "all" | "products" | "categories" | "brands" | "skus"

function inScope(product: Record<string, any> | undefined, coupon: Record<string, any>): boolean {
  const scope: ApplyScope = coupon.applyScope || "all"
  if (scope === "all") return true
  if (!product) return false
  if (scope === "products") {
    return (coupon.productIds || []).includes(product.id || product._id?.toString?.())
  }
  if (scope === "categories") {
    return (coupon.categoryIds || []).includes(product.category || product.categoryId)
  }
  if (scope === "brands") {
    const brand = String(product.brand || product.brandId || "").toLowerCase()
    return (coupon.brands || []).map((b: string) => b.toLowerCase()).includes(brand)
  }
  if (scope === "skus") {
    const sku = String(product.sku || "").toLowerCase()
    return (coupon.skus || []).map((s: string) => s.toLowerCase()).includes(sku)
  }
  return false
}

/** Mirrors /api/coupons/validate so the quoted discount matches the charged discount. */
async function computeCouponDiscount(
  code: string,
  pricedItems: PricedItem[],
  catalogue: Map<string, Record<string, any>>,
  userId: string | null,
): Promise<{ ok: true; coupon: { code: string; name: string; discount: number } } | { ok: false; error: string }> {
  const couponsCol = await getCollection(COLLECTIONS.COUPONS)
  const coupon = await couponsCol.findOne({ code: code.toUpperCase().trim(), active: true })
  if (!coupon) return { ok: false, error: "Coupon not found or inactive" }

  const now = new Date()
  if (coupon.startDate && now < new Date(coupon.startDate)) return { ok: false, error: "Coupon not yet valid" }
  if (!coupon.noEndDate && coupon.endDate && now > new Date(coupon.endDate)) {
    return { ok: false, error: "Coupon expired" }
  }

  const usageLimit = Number(coupon.usageLimit) || 0
  if (usageLimit > 0 && (Number(coupon.usageCount) || 0) >= usageLimit) {
    return { ok: false, error: "Coupon usage limit reached" }
  }

  const perCustomerLimit = Number(coupon.perCustomerLimit) || 0
  if (perCustomerLimit > 0) {
    // A guest cannot be counted against a per-customer cap, so the only safe
    // answer is to require an account for these coupons.
    if (!userId) return { ok: false, error: "Sign in to use this coupon" }
    const userRecord = (coupon.usageByUser || []).find((u: { userId: string }) => u.userId === userId)
    if ((Number(userRecord?.count) || 0) >= perCustomerLimit) {
      return { ok: false, error: "Per-customer limit reached for this coupon" }
    }
  }

  const eligible = pricedItems.filter((i) => inScope(catalogue.get(i.id), coupon))
  if (eligible.length === 0) return { ok: false, error: "Coupon does not apply to these items" }

  const eligibleSubtotal = eligible.reduce((s, i) => s + i.price * i.quantity, 0)
  let discount = 0

  if (coupon.type === "fixed") {
    discount = Math.min(Number(coupon.value) || 0, eligibleSubtotal)
  } else if (coupon.type === "percentage") {
    const raw = (eligibleSubtotal * (Number(coupon.value) || 0)) / 100
    discount = coupon.maxDiscount ? Math.min(raw, Number(coupon.maxDiscount)) : raw
  } else if (coupon.type === "buy_get") {
    const buyQty = Number(coupon.buyQty) || 0
    const getQty = Number(coupon.getQty) || 0
    const group = buyQty + getQty
    let freeUnits = 0
    if (group > 0) for (const i of eligible) freeUnits += Math.floor(i.quantity / group) * getQty
    const unitPrices: number[] = []
    for (const i of eligible) for (let k = 0; k < i.quantity; k++) unitPrices.push(i.price)
    unitPrices.sort((a, b) => a - b)
    discount = unitPrices.slice(0, freeUnits).reduce((s, p) => s + p, 0)
  }

  if (!Number.isFinite(discount) || discount <= 0) return { ok: false, error: "No discount from this coupon" }

  return { ok: true, coupon: { code: coupon.code, name: coupon.name, discount: Math.round(discount) } }
}

/**
 * Recomputes an order from the catalogue. Client-supplied prices and totals are
 * ignored entirely — only product identifiers and quantities are honoured.
 */
export async function priceOrder(
  rawItems: IncomingItem[],
  options: { couponCode?: string | null; userId: string | null },
): Promise<PricingResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: "Order must contain at least one item" }
  }
  if (rawItems.length > 50) return { ok: false, error: "Too many items in order" }

  const catalogue = await loadCatalogue(rawItems)
  const items: PricedItem[] = []
  const byId = new Map<string, Record<string, any>>()

  for (const raw of rawItems) {
    const keys = keysFor(raw)
    if (keys.length === 0) return { ok: false, error: "Every item must include a product id" }

    const doc = keys.map((k) => catalogue.get(k)).find(Boolean)
    if (!doc) return { ok: false, error: `Product not available: ${keys[0]}` }
    if (doc.active === false) return { ok: false, error: `Product is no longer available: ${doc.name || keys[0]}` }

    const quantity = Math.floor(Number(raw.quantity ?? 1))
    if (!Number.isFinite(quantity) || quantity < 1) return { ok: false, error: "Invalid quantity" }
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      return { ok: false, error: `Maximum ${MAX_QUANTITY_PER_ITEM} units per item` }
    }

    const price = Number(doc.price)
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, error: `Product is not purchasable: ${doc.name || keys[0]}` }
    }

    const stock = Number(doc.stock)
    if (Number.isFinite(stock) && stock < quantity) {
      return { ok: false, error: `Insufficient stock for ${doc.name || keys[0]}` }
    }

    const id = (doc.id || doc._id?.toString?.() || keys[0]) as string
    byId.set(id, doc)

    items.push({
      id,
      name: String(doc.name || doc.title || "Product"),
      price,
      quantity,
      image: doc.image || (Array.isArray(doc.images) ? doc.images[0] : null) || null,
      category: doc.category || null,
      subCategory: doc.subCategory || null,
      type: doc.type === "software" || raw.type === "software" ? "software" : "hardware",
      provider: doc.provider || raw.provider || null,
      source: doc.source || raw.source || null,
      kgenProductId: raw.kgenProductId || raw.externalProductId || null,
      kgenVariantId: raw.kgenVariantId || raw.externalVariantId || null,
      packSize: toText(raw.packSize),
      validityYears: toText(raw.validityYears),
      maxDevices: toText(raw.maxDevices),
      validity: raw.validity || null,
      color: raw.color || null,
      size: raw.size || null,
    })
  }

  const gross = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const subtotal = items.reduce((s, i) => s + (i.price / (1 + GST_RATE)) * i.quantity, 0)
  const tax = subtotal * GST_RATE

  const hardwareGross = items
    .filter((i) => i.type !== "software")
    .reduce((s, i) => s + i.price * i.quantity, 0)
  const { shippingFee, freeShippingThreshold } = await getShippingSettings()
  const shipping = hardwareGross > 0 && hardwareGross < freeShippingThreshold ? shippingFee : 0

  let coupon: PricingSuccess["coupon"] = null
  let couponDiscount = 0
  if (options.couponCode) {
    const result = await computeCouponDiscount(options.couponCode, items, byId, options.userId)
    if (!result.ok) return { ok: false, error: result.error }
    coupon = result.coupon
    couponDiscount = result.coupon.discount
  }

  const total = Math.max(0, gross - couponDiscount) + shipping

  return {
    ok: true,
    items,
    subtotal: round2(subtotal),
    tax: round2(tax),
    shipping: round2(shipping),
    gross: round2(gross),
    couponDiscount: round2(couponDiscount),
    coupon,
    total: round2(total),
  }
}
