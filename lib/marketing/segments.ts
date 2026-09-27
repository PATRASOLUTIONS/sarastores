/**
 * Marketing segmentation taxonomy.
 *
 * A customer is never in exactly one bucket — they are a champion *and* platinum
 * *and* a TV buyer at the same time. So the resolver tags every recipient with all
 * the segments they belong to, and "selecting a segment" is a filter over those
 * tags rather than a separate query per segment. That keeps counts consistent
 * across the UI and lets a campaign target an intersection later without a rewrite.
 *
 * Authoritative spend/recency comes from `customer_profiles` (the nightly rollup).
 * Guests who checked out without an account have no profile, so their totals are
 * aggregated from `orders` and they are tagged on the same rules.
 */

import { getCollection } from "@/lib/db-service"
import { COLLECTION_CUSTOMER_PROFILES } from "@/lib/customer-profile"

export type SegmentGroup =
  | "lifecycle"
  | "tier"
  | "behaviour"
  | "engagement"
  | "category"
  | "consent"

export type SegmentDef = {
  key: string
  label: string
  description: string
  group: SegmentGroup
  /** Marketing intent, used to suggest a matching template. */
  intent: "reward" | "retain" | "reactivate" | "convert" | "grow" | "broadcast"
}

export const SEGMENT_GROUP_LABELS: Record<SegmentGroup, string> = {
  lifecycle: "Lifecycle (RFM)",
  tier: "Spend tier",
  behaviour: "Purchase behaviour",
  engagement: "Engagement",
  category: "Category affinity",
  consent: "Contactable",
}

export const SEGMENTS: SegmentDef[] = [
  // Everyone
  { key: "all", label: "All customers", description: "Every registered customer and past buyer.", group: "engagement", intent: "broadcast" },

  // Lifecycle — mirrors lib/retention/segmentation.ts
  { key: "champion", label: "Champions", description: "Recent, high value. Your best customers.", group: "lifecycle", intent: "reward" },
  { key: "loyal", label: "Loyal", description: "Recent buyers with solid value.", group: "lifecycle", intent: "retain" },
  { key: "promising", label: "Promising", description: "Bought recently but low value so far.", group: "lifecycle", intent: "grow" },
  { key: "at_risk", label: "At risk", description: "No purchase in 3–6 months.", group: "lifecycle", intent: "reactivate" },
  { key: "lapsed", label: "Lapsed", description: "No purchase in 6–12 months.", group: "lifecycle", intent: "reactivate" },
  { key: "lost", label: "Lost", description: "No purchase in over a year.", group: "lifecycle", intent: "reactivate" },

  // Tier
  { key: "tier_platinum", label: "Platinum", description: "₹1,00,000+ in the last 12 months.", group: "tier", intent: "reward" },
  { key: "tier_gold", label: "Gold", description: "₹25,000–₹99,999 in the last 12 months.", group: "tier", intent: "grow" },
  { key: "tier_silver", label: "Silver", description: "Under ₹25,000 in the last 12 months.", group: "tier", intent: "grow" },

  // Behaviour
  { key: "new_customer", label: "New customers", description: "First order within the last 30 days.", group: "behaviour", intent: "retain" },
  { key: "one_time", label: "One-time buyers", description: "Exactly one order ever — the biggest growth pool.", group: "behaviour", intent: "grow" },
  { key: "repeat", label: "Repeat buyers", description: "Two or more orders.", group: "behaviour", intent: "retain" },
  { key: "frequent", label: "Frequent buyers", description: "Five or more orders.", group: "behaviour", intent: "reward" },
  { key: "high_aov", label: "Big basket", description: "Average order value of ₹50,000 or more.", group: "behaviour", intent: "reward" },
  { key: "high_spenders", label: "High spenders", description: "₹10,000+ lifetime spend.", group: "behaviour", intent: "reward" },

  // Engagement
  { key: "active", label: "Active (30 days)", description: "Ordered in the last 30 days.", group: "engagement", intent: "retain" },
  { key: "dormant", label: "Dormant (30+ days)", description: "No order in the last 30 days.", group: "engagement", intent: "reactivate" },
  { key: "no_purchase", label: "Registered, never bought", description: "Has an account but no completed order.", group: "engagement", intent: "convert" },
  { key: "abandoned_cart", label: "Abandoned cart", description: "Items sitting in the cart right now.", group: "engagement", intent: "convert" },
  { key: "wishlist_active", label: "Wishlist holders", description: "Has saved products to a wishlist.", group: "engagement", intent: "convert" },

  // Category affinity
  { key: "cat_television", label: "TV buyers", description: "Has bought a television.", group: "category", intent: "grow" },
  { key: "cat_refrigerator", label: "Refrigerator buyers", description: "Has bought a refrigerator.", group: "category", intent: "grow" },
  { key: "cat_washing_machine", label: "Washing machine buyers", description: "Has bought a washing machine.", group: "category", intent: "grow" },
  { key: "cat_air_conditioner", label: "AC / cooling buyers", description: "Has bought an AC or air cooler.", group: "category", intent: "grow" },
  { key: "cat_kitchen", label: "Kitchen appliance buyers", description: "Has bought a dishwasher, oven or built-in appliance.", group: "category", intent: "grow" },

  // Consent
  { key: "email_optin", label: "Email opted in", description: "Consented to marketing email.", group: "consent", intent: "broadcast" },
  { key: "whatsapp_optin", label: "WhatsApp opted in", description: "Consented to marketing WhatsApp.", group: "consent", intent: "broadcast" },
]

export const SEGMENT_BY_KEY: Record<string, SegmentDef> = Object.fromEntries(
  SEGMENTS.map((s) => [s.key, s]),
)

export type Recipient = {
  id: string
  name: string
  email: string
  phone: string
  source: "registered" | "orders" | "both"
  totalOrders: number
  totalSpent: number
  averageOrderValue: number
  lastOrderAt: string | null
  firstOrderAt: string | null
  tier: string | null
  lifecycle: string | null
  categories: string[]
  consent: { email: boolean; whatsapp: boolean; sms: boolean }
  /** Every segment key this recipient belongs to. */
  segments: string[]
}

const DAY = 24 * 60 * 60 * 1000
const HIGH_SPENDER_MIN = 10000
const BIG_BASKET_MIN = 50000

/**
 * Maps free-text product signals onto a marketing affinity segment.
 *
 * Reads product names as well as categories: orders written before the pricing
 * rewrite stored `category: null`, and the top-level category is "HOME APPLIANCES"
 * for almost everything, so the name is often the only usable signal.
 */
function categorySegments(signals: string[]): string[] {
  const blob = signals.join(" ").toLowerCase()
  const out: string[] = []
  if (/\btvs?\b|television|\bpanel\b|qled|oled|led tv|smart tv|inches\)/.test(blob)) out.push("cat_television")
  if (/refrigerator|fridge|freezer/.test(blob)) out.push("cat_refrigerator")
  if (/washing machine|washer|laundry|front loader|top load/.test(blob)) out.push("cat_washing_machine")
  if (/air condition|split ac|\bac\b|air cooler|\bcooler\b/.test(blob)) out.push("cat_air_conditioner")
  if (/dishwasher|\boven\b|microwave|built.?in|chimney|\bhob\b|cooktop|heat drawer/.test(blob)) out.push("cat_kitchen")
  return out
}

function toIso(value: unknown): string | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Assigns every segment tag a single recipient qualifies for. */
export function tagRecipient(r: Omit<Recipient, "segments">): string[] {
  const tags = new Set<string>(["all"])
  const now = Date.now()
  const last = r.lastOrderAt ? new Date(r.lastOrderAt).getTime() : null
  const first = r.firstOrderAt ? new Date(r.firstOrderAt).getTime() : null

  if (r.lifecycle) tags.add(r.lifecycle)
  if (r.tier) tags.add(`tier_${r.tier}`)

  if (last !== null && now - last <= 30 * DAY) tags.add("active")
  else tags.add("dormant")

  if (r.totalOrders === 0) tags.add("no_purchase")
  if (r.totalOrders === 1) tags.add("one_time")
  if (r.totalOrders >= 2) tags.add("repeat")
  if (r.totalOrders >= 5) tags.add("frequent")
  if (first !== null && now - first <= 30 * DAY) tags.add("new_customer")
  if (r.totalSpent >= HIGH_SPENDER_MIN) tags.add("high_spenders")
  if (r.averageOrderValue >= BIG_BASKET_MIN) tags.add("high_aov")

  for (const c of categorySegments(r.categories)) tags.add(c)

  if (r.consent.email) tags.add("email_optin")
  if (r.consent.whatsapp) tags.add("whatsapp_optin")

  return [...tags]
}

/**
 * Builds the full addressable audience once, tagged with every segment.
 * Callers filter by tag rather than re-querying per segment.
 */
export async function buildAudience(): Promise<Recipient[]> {
  const [usersCol, ordersCol, profilesCol, cartsCol, wishlistsCol] = await Promise.all([
    getCollection("users"),
    getCollection("orders"),
    getCollection(COLLECTION_CUSTOMER_PROFILES),
    getCollection("carts"),
    getCollection("wishlists"),
  ])

  const [users, profiles, carts, wishlists] = await Promise.all([
    usersCol.find({ role: { $ne: "admin" } }).limit(20000).toArray(),
    profilesCol.find({}).limit(20000).toArray(),
    cartsCol.find({}, { projection: { userId: 1, items: 1 } }).limit(20000).toArray(),
    wishlistsCol.find({}, { projection: { userId: 1, items: 1 } }).limit(20000).toArray(),
  ])

  const profileByUser = new Map(profiles.map((p: any) => [String(p.userId), p]))
  const cartUserIds = new Set(
    carts.filter((c: any) => Array.isArray(c.items) && c.items.length > 0).map((c: any) => String(c.userId)),
  )
  const wishlistUserIds = new Set(
    wishlists.filter((w: any) => Array.isArray(w.items) && w.items.length > 0).map((w: any) => String(w.userId)),
  )

  // Guest orders still represent a contactable customer, so they are folded in by email.
  const orders = await ordersCol
    .find({}, { projection: { userId: 1, customer: 1, total: 1, createdAt: 1, items: 1, status: 1 } })
    .limit(50000)
    .toArray()

  type Agg = { orders: number; spent: number; first: number | null; last: number | null; cats: Set<string>; name: string; phone: string }
  const byEmail = new Map<string, Agg>()

  for (const o of orders as any[]) {
    const email = String(o?.customer?.email || "").trim().toLowerCase()
    if (!email) continue
    const ts = o.createdAt ? new Date(o.createdAt).getTime() : null
    const existing = byEmail.get(email) ?? {
      orders: 0, spent: 0, first: null, last: null, cats: new Set<string>(),
      name: o?.customer?.name || `${o?.customer?.firstName || ""} ${o?.customer?.lastName || ""}`.trim() || email,
      phone: o?.customer?.phone || "",
    }
    existing.orders += 1
    existing.spent += Number(o.total) || 0
    if (ts !== null) {
      if (existing.first === null || ts < existing.first) existing.first = ts
      if (existing.last === null || ts > existing.last) existing.last = ts
    }
    for (const it of (o.items ?? []) as any[]) {
      for (const signal of [it?.category, it?.subCategory, it?.name]) {
        if (typeof signal === "string" && signal.trim()) existing.cats.add(signal.trim())
      }
    }
    if (!existing.phone && o?.customer?.phone) existing.phone = o.customer.phone
    byEmail.set(email, existing)
  }

  const out: Recipient[] = []
  const seenEmails = new Set<string>()

  for (const u of users as any[]) {
    const email = String(u.email || "").trim().toLowerCase()
    const userId = String(u._id)
    const profile: any = profileByUser.get(userId)
    const agg = email ? byEmail.get(email) : undefined
    if (email) seenEmails.add(email)

    const totalOrders = profile?.orderCount ?? agg?.orders ?? 0
    const totalSpent = profile?.lifetimeSpend ?? agg?.spent ?? 0
    // The profile rollup only stores coarse categories, so order-derived signals
    // (which include product names) are merged in for affinity matching.
    const categories: string[] = [...new Set([...(profile?.categoriesBought ?? []), ...(agg?.cats ?? [])])]

    const base = {
      id: userId,
      name: u.name || u.fullName || email,
      email,
      phone: u.phone || u.mobile || agg?.phone || "",
      source: (agg ? "both" : "registered") as Recipient["source"],
      totalOrders,
      totalSpent,
      averageOrderValue: profile?.averageOrderValue ?? (totalOrders ? totalSpent / totalOrders : 0),
      lastOrderAt: toIso(profile?.lastOrderAt) ?? (agg?.last ? new Date(agg.last).toISOString() : null),
      firstOrderAt: toIso(profile?.firstOrderAt) ?? (agg?.first ? new Date(agg.first).toISOString() : null),
      tier: profile?.tier ?? null,
      lifecycle: profile?.segment ?? null,
      categories,
      consent: profile?.consent ?? { email: false, whatsapp: false, sms: false },
    }

    const segments = tagRecipient(base)
    if (cartUserIds.has(userId)) segments.push("abandoned_cart")
    if (wishlistUserIds.has(userId)) segments.push("wishlist_active")
    out.push({ ...base, segments })
  }

  for (const [email, agg] of byEmail) {
    if (seenEmails.has(email)) continue
    const base = {
      id: `order-${email}`,
      name: agg.name,
      email,
      phone: agg.phone,
      source: "orders" as const,
      totalOrders: agg.orders,
      totalSpent: agg.spent,
      averageOrderValue: agg.orders ? agg.spent / agg.orders : 0,
      lastOrderAt: agg.last ? new Date(agg.last).toISOString() : null,
      firstOrderAt: agg.first ? new Date(agg.first).toISOString() : null,
      tier: null,
      lifecycle: null,
      categories: [...agg.cats],
      consent: { email: false, whatsapp: false, sms: false },
    }
    out.push({ ...base, segments: tagRecipient(base) })
  }

  out.sort((a, b) => new Date(b.lastOrderAt ?? 0).getTime() - new Date(a.lastOrderAt ?? 0).getTime())
  return out
}

export function countBySegment(audience: Recipient[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const def of SEGMENTS) counts[def.key] = 0
  for (const r of audience) {
    for (const key of r.segments) counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export function filterBySegment(audience: Recipient[], segment: string): Recipient[] {
  if (!segment || segment === "all") return audience
  return audience.filter((r) => r.segments.includes(segment))
}
