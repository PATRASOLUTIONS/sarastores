import { type ClientSession, ObjectId } from "mongodb"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { cartLimitError, MAX_CART_PRODUCTS } from "@/lib/cart-limits"

// Catalogue prices are GST-inclusive; base and tax are derived from them.
const GST_RATE = 0.18
const DEFAULT_SHIPPING_FEE = 99
const DEFAULT_FREE_SHIPPING_THRESHOLD = 1000

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

export type CouponDetails =
  | { type: "fixed"; value: number }
  | { type: "percentage"; value: number; maxDiscount: number | null }
  | { type: "buy_get"; buyQty: number; getQty: number; freeUnits: number }

interface PricingCatalogueProduct {
  _id?: ObjectId | string
  id?: string
  sku?: string
  active?: boolean
  name?: string
  title?: string
  price?: number | string
  stock?: number | string
  image?: string | null
  images?: string[]
  category?: string
  categoryId?: string
  subCategory?: string
  brand?: string
  brandId?: string
  type?: string
  provider?: string | null
  source?: string | null
  kgenProductId?: string | null
  externalProductId?: string | null
  kgenVariantId?: string | null
  externalVariantId?: string | null
  packSize?: string | number | null
  validityYears?: string | number | null
  maxDevices?: string | number | null
  validity?: string | number | null
}

interface PricingCoupon {
  code: string
  name: string
  active: boolean
  type: "fixed" | "percentage" | "buy_get"
  applyScope?: "all" | "products" | "categories" | "brands" | "skus"
  productIds?: string[]
  categoryIds?: string[]
  brands?: string[]
  skus?: string[]
  startDate?: Date | string | null
  endDate?: Date | string | null
  noEndDate?: boolean
  usageLimit?: number | null
  usageCount?: number
  perCustomerLimit?: number | null
  usageByUser?: Array<{ userId: string; count: number; lastUsed?: Date }>
  value?: number
  maxDiscount?: number | null
  buyQty?: number | null
  getQty?: number | null
}

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

function docKeys(doc: PricingCatalogueProduct): string[] {
  return [doc.id, doc._id?.toString?.(), doc.sku].filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  )
}

async function loadCatalogue(items: IncomingItem[], session?: ClientSession) {
  const allKeys = [...new Set(items.flatMap(keysFor))]
  if (allKeys.length === 0) return new Map<string, PricingCatalogueProduct>()

  const load = async (name: string) => {
    const col = await getCollection<PricingCatalogueProduct>(name)
    return col.find(idMatchQuery(allKeys), { session }).toArray()
  }
  const [products, software] = session
    ? [await load(COLLECTIONS.PRODUCTS), await load("software_products")]
    : await Promise.all([load(COLLECTIONS.PRODUCTS), load("software_products")])

  const byKey = new Map<string, PricingCatalogueProduct>()
  for (const doc of [...products, ...software.map((product) => ({ ...product, type: "software" }))]) {
    for (const k of docKeys(doc)) if (!byKey.has(k)) byKey.set(k, doc)
  }
  return byKey
}

export async function getShippingSettings() {
  const settings = await getCollection<{ shippingFee?: number | string | null; freeShippingThreshold?: number | string | null }>("settings")
  const doc = await settings.findOne({}, { projection: { shippingFee: 1, freeShippingThreshold: 1 } })
  const number = (value: number | string | null | undefined, fallback: number) => {
    if (value == null) return fallback
    if ((typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim()) ||
      !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error("Shipping settings are invalid")
    return Number(value)
  }
  return {
    shippingFee: number(doc?.shippingFee, DEFAULT_SHIPPING_FEE),
    freeShippingThreshold: number(doc?.freeShippingThreshold, DEFAULT_FREE_SHIPPING_THRESHOLD),
  }
}

function inScope(product: PricingCatalogueProduct | undefined, coupon: PricingCoupon): boolean {
  const scope = coupon.applyScope || "all"
  if (scope === "all") return true
  if (!product) return false
  if (scope === "products") {
    const id = product.id || product._id?.toString()
    return !!id && (coupon.productIds || []).includes(id)
  }
  if (scope === "categories") {
    const category = product.category || product.categoryId
    return !!category && (coupon.categoryIds || []).includes(category)
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

async function computeCouponDiscount(
  code: string,
  pricedItems: PricedItem[],
  catalogue: Map<string, PricingCatalogueProduct>,
  userId: string | null,
  session?: ClientSession,
): Promise<{ ok: true; coupon: { code: string; name: string; discount: number }; details: CouponDetails } | { ok: false; error: string }> {
  const couponsCol = await getCollection<PricingCoupon>(COLLECTIONS.COUPONS)
  const coupon = await couponsCol.findOne({ code: code.toUpperCase().trim(), active: true }, { session })
  if (!coupon) return { ok: false, error: "Coupon not found or inactive" }

  const now = new Date()
  const start = coupon.startDate ? new Date(coupon.startDate) : null
  const end = !coupon.noEndDate && coupon.endDate ? new Date(coupon.endDate) : null
  if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime()))) {
    return { ok: false, error: "Coupon validity dates are invalid" }
  }
  if (start && now < start) return { ok: false, error: "Coupon not yet valid" }
  if (end && now > end) {
    return { ok: false, error: "Coupon expired" }
  }

  const usageLimit = Number(coupon.usageLimit ?? 0)
  const usageCount = Number(coupon.usageCount ?? 0)
  const perCustomerLimit = Number(coupon.perCustomerLimit ?? 0)
  if ([usageLimit, usageCount, perCustomerLimit].some(value => !Number.isSafeInteger(value) || value < 0)) {
    return { ok: false, error: "Coupon usage limits are invalid" }
  }
  if (usageLimit > 0 && usageCount >= usageLimit) {
    return { ok: false, error: "Coupon usage limit reached" }
  }

  if (perCustomerLimit > 0) {
    // A guest cannot be counted against a per-customer cap, so the only safe
    // answer is to require an account for these coupons.
    if (!userId) return { ok: false, error: "Sign in to use this coupon" }
    const userRecord = (coupon.usageByUser || []).find((u: { userId: string }) => u.userId === userId)
    const count = Number(userRecord?.count ?? 0)
    if (!Number.isSafeInteger(count) || count < 0) return { ok: false, error: "Coupon customer usage is invalid" }
    if (count >= perCustomerLimit) {
      return { ok: false, error: "Per-customer limit reached for this coupon" }
    }
  }

  const eligible = pricedItems.filter((i) => inScope(catalogue.get(i.id), coupon))
  if (eligible.length === 0) return { ok: false, error: "Coupon does not apply to these items" }

  const eligibleSubtotal = eligible.reduce((s, i) => s + i.price * i.quantity, 0)
  let discount = 0
  let details: CouponDetails

  if (coupon.type === "fixed") {
    const value = Number(coupon.value)
    if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "Coupon value is invalid" }
    discount = Math.min(value, eligibleSubtotal)
    details = { type: "fixed", value }
  } else if (coupon.type === "percentage") {
    const value = Number(coupon.value)
    const maxDiscount = coupon.maxDiscount == null ? null : Number(coupon.maxDiscount)
    if (!Number.isFinite(value) || value <= 0 || value > 100 ||
      (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount <= 0))) {
      return { ok: false, error: "Coupon value is invalid" }
    }
    const raw = (eligibleSubtotal * value) / 100
    discount = maxDiscount === null ? raw : Math.min(raw, maxDiscount)
    details = { type: "percentage", value, maxDiscount }
  } else if (coupon.type === "buy_get") {
    const buyQty = Number(coupon.buyQty)
    const getQty = Number(coupon.getQty)
    const group = buyQty + getQty
    if (!Number.isSafeInteger(buyQty) || buyQty < 1 || !Number.isSafeInteger(getQty) || getQty < 1 ||
      !Number.isSafeInteger(group)) return { ok: false, error: "Coupon quantities are invalid" }
    let freeUnits = 0
    for (const i of eligible) freeUnits += Math.floor(i.quantity / group) * getQty
    if (!Number.isSafeInteger(freeUnits)) return { ok: false, error: "Coupon quantities are invalid" }
    let remaining = freeUnits
    // Keep the existing cheapest-unit policy without allocating one entry per unit.
    for (const item of [...eligible].sort((a, b) => a.price - b.price)) {
      const units = Math.min(remaining, item.quantity)
      discount += units * item.price
      remaining -= units
      if (remaining === 0) break
    }
    details = { type: "buy_get", buyQty, getQty, freeUnits }
  } else {
    return { ok: false, error: "Coupon type is invalid" }
  }

  if (!Number.isFinite(discount) || discount <= 0) return { ok: false, error: "No discount from this coupon" }
  discount = Math.min(Math.round(discount), round2(eligibleSubtotal))
  if (discount <= 0) return { ok: false, error: "No discount from this coupon" }

  return { ok: true, coupon: { code: coupon.code, name: coupon.name, discount }, details }
}

async function priceCatalogueCart(
  rawItems: IncomingItem[],
  session?: ClientSession,
): Promise<{ ok: true; items: PricedItem[]; catalogue: Map<string, PricingCatalogueProduct> } | { ok: false; error: string }> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: "Order must contain at least one item" }
  }
  if (rawItems.length > MAX_CART_PRODUCTS) return { ok: false, error: "You can add up to 20 different products to your cart." }

  const catalogue = await loadCatalogue(rawItems, session)
  const items: PricedItem[] = []
  const byId = new Map<string, PricingCatalogueProduct>()

  for (const raw of rawItems) {
    const keys = keysFor(raw)
    if (keys.length === 0) return { ok: false, error: "Every item must include a product id" }

    const doc = keys.map((k) => catalogue.get(k)).find(Boolean)
    if (!doc) return { ok: false, error: `Product not available: ${keys[0]}` }
    if (doc.active === false) return { ok: false, error: `Product is no longer available: ${doc.name || keys[0]}` }

    const quantity = Number(raw.quantity ?? 1)
    if (!Number.isSafeInteger(quantity) || quantity < 1) return { ok: false, error: "Invalid quantity" }

    const price = Number(doc.price)
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, error: `Product is not purchasable: ${doc.name || keys[0]}` }
    }

    const stock = Number(doc.stock)
    if (Number.isFinite(stock) && stock < quantity) {
      return { ok: false, error: `Insufficient stock for ${doc.name || keys[0]}` }
    }

    const id = doc.id || doc._id?.toString() || keys[0]
    if (items.some((item) => item.id === id)) return { ok: false, error: "Combine duplicate products into one cart line." }
    byId.set(id, doc)

    items.push({
      id,
      name: String(doc.name || doc.title || "Product"),
      price,
      quantity,
      image: doc.image || (Array.isArray(doc.images) ? doc.images[0] : null) || null,
      category: doc.category || null,
      subCategory: doc.subCategory || null,
      type: doc.type === "software" ? "software" : "hardware",
      provider: doc.provider || null,
      source: doc.source || null,
      kgenProductId: doc.kgenProductId || doc.externalProductId || null,
      kgenVariantId: doc.kgenVariantId || doc.externalVariantId || null,
      packSize: toText(doc.packSize),
      validityYears: toText(doc.validityYears),
      maxDevices: toText(doc.maxDevices),
      validity: toText(doc.validity),
      color: raw.color || null,
      size: raw.size || null,
    })
  }

  const limitError = cartLimitError(items)
  if (limitError) return { ok: false, error: limitError }
  return { ok: true, items, catalogue: byId }
}

export async function quoteCoupon(rawItems: IncomingItem[], code: string, userId: string | null, session?: ClientSession) {
  const cart = await priceCatalogueCart(rawItems, session)
  if (!cart.ok) return cart
  return computeCouponDiscount(code, cart.items, cart.catalogue, userId, session)
}

/** Called inside the order transaction, never by a client redemption request. */
export async function consumeOrderCoupon(
  rawItems: IncomingItem[],
  expected: NonNullable<PricingSuccess["coupon"]>,
  userId: string | null,
  session: ClientSession,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const quote = await quoteCoupon(rawItems, expected.code, userId, session)
  if (!quote.ok) return quote
  if (quote.coupon.code !== expected.code || quote.coupon.discount !== expected.discount) {
    return { ok: false, error: "Coupon changed. Please refresh your checkout." }
  }
  const col = await getCollection<PricingCoupon>(COLLECTIONS.COUPONS)
  const coupon = await col.findOne({ code: expected.code, active: true }, { session })
  if (!coupon) return { ok: false, error: "Coupon is no longer available" }
  const existing = userId && (coupon.usageByUser || []).some(record => record.userId === userId)
  const now = new Date()
  const result = await col.updateOne(
    { _id: coupon._id },
    existing ? {
      $inc: { usageCount: 1, "usageByUser.$[user].count": 1 },
      $set: { "usageByUser.$[user].lastUsed": now },
    } : {
      $inc: { usageCount: 1 },
      ...(userId ? { $push: { usageByUser: { userId, count: 1, lastUsed: now } } } : {}),
    },
    { session, ...(existing ? { arrayFilters: [{ "user.userId": userId }] } : {}) },
  )
  if (result.modifiedCount !== 1) return { ok: false, error: "Coupon usage could not be recorded" }
  return { ok: true }
}

/**
 * Recomputes an order from the catalogue. Client-supplied prices and totals are
 * ignored entirely — only product identifiers and quantities are honoured.
 */
export async function priceOrder(
  rawItems: IncomingItem[],
  options: { couponCode?: string | null; userId: string | null; fulfilment?: { method?: string; storeId?: string } | null },
): Promise<PricingResult> {
  const cart = await priceCatalogueCart(rawItems)
  if (!cart.ok) return cart
  const { items, catalogue } = cart
  const gross = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const subtotal = items.reduce((s, i) => s + (i.price / (1 + GST_RATE)) * i.quantity, 0)
  const tax = subtotal * GST_RATE

  const hardwareGross = items
    .filter((i) => i.type !== "software")
    .reduce((s, i) => s + i.price * i.quantity, 0)
  const { shippingFee, freeShippingThreshold } = await getShippingSettings()
  let shipping = hardwareGross > 0 && hardwareGross < freeShippingThreshold ? shippingFee : 0
  if (options.fulfilment?.method === "pickup") {
    const storeId = options.fulfilment.storeId
    if (!storeId || !ObjectId.isValid(storeId)) return { ok: false, error: "Please choose a valid pickup store." }
    const stores = await getCollection("store_locations")
    const store = await stores.findOne({ _id: new ObjectId(storeId), isActive: true })
    if (!store) return { ok: false, error: "The selected pickup store is unavailable." }
    shipping = 0
  }

  let coupon: PricingSuccess["coupon"] = null
  let couponDiscount = 0
  if (options.couponCode) {
    const result = await computeCouponDiscount(options.couponCode, items, catalogue, options.userId)
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
