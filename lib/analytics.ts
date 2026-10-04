"use client"

/**
 * Front-end analytics emitter.
 *
 * Pushes GA4-shaped ecommerce events to `window.dataLayer` (so GTM or GA4 can be
 * attached later without touching call sites) and mirrors them to /api/events so
 * the funnel is measurable today, before any third-party tag exists.
 */

import { hasConsent } from "@/lib/consent-client"

type Money = number | string
export type AnalyticsItem = {
  item_id: string
  item_name: string
  price?: number
  quantity?: number
  item_category?: string | null
  item_brand?: string | null
}

const toNumber = (v: Money | undefined): number => {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? 0))
  return Number.isFinite(n) ? n : 0
}

export function toAnalyticsItem(raw: any, quantity?: number): AnalyticsItem {
  return {
    item_id: String(raw?.id ?? raw?.productId ?? raw?._id ?? ""),
    item_name: String(raw?.name ?? raw?.title ?? "Unknown"),
    price: toNumber(raw?.price),
    quantity: quantity ?? toNumber(raw?.quantity) ?? 1,
    item_category: raw?.category ?? null,
    item_brand: raw?.brand ?? null,
  }
}

function itemsValue(items: AnalyticsItem[]): number {
  return items.reduce((sum, i) => sum + toNumber(i.price) * (i.quantity || 1), 0)
}

export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return

  /**
   * DPDP: usage measurement is not necessary to operate the store, so nothing
   * is emitted until the visitor has granted the analytics category. An
   * undecided visitor counts as a refusal.
   */
  if (!hasConsent("analytics")) return

  const payload = { event, ...params }

  try {
    const w = window as any
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push(payload)
    // Fires only if a GA4/gtag tag is added later.
    if (typeof w.gtag === "function") w.gtag("event", event, params)
  } catch {
    // analytics must never break the page
  }

  try {
    const body = JSON.stringify({
      event,
      params,
      page: window.location.pathname,
      ts: Date.now(),
    })
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }))
    } else {
      fetch("/api/events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {})
    }
  } catch {
    // ignore
  }
}

export const analytics = {
  viewItem: (item: AnalyticsItem) =>
    track("view_item", { currency: "INR", value: toNumber(item.price), items: [item] }),

  addToCart: (item: AnalyticsItem) =>
    track("add_to_cart", { currency: "INR", value: toNumber(item.price) * (item.quantity || 1), items: [item] }),

  removeFromCart: (item: AnalyticsItem) =>
    track("remove_from_cart", { currency: "INR", value: toNumber(item.price) * (item.quantity || 1), items: [item] }),

  viewCart: (items: AnalyticsItem[]) =>
    track("view_cart", { currency: "INR", value: itemsValue(items), items }),

  beginCheckout: (items: AnalyticsItem[]) =>
    track("begin_checkout", { currency: "INR", value: itemsValue(items), items }),

  addPaymentInfo: (items: AnalyticsItem[], paymentMethod: string) =>
    track("add_payment_info", { currency: "INR", value: itemsValue(items), payment_type: paymentMethod, items }),

  purchase: (opts: { transactionId: string; value: number; tax?: number; shipping?: number; coupon?: string | null; items: AnalyticsItem[] }) =>
    track("purchase", {
      transaction_id: opts.transactionId,
      currency: "INR",
      value: toNumber(opts.value),
      tax: toNumber(opts.tax),
      shipping: toNumber(opts.shipping),
      coupon: opts.coupon ?? undefined,
      items: opts.items,
    }),

  search: (term: string) => track("search", { search_term: term }),

  generateLead: (source: string) => track("generate_lead", { source }),

  signUp: (method = "password") => track("sign_up", { method }),

  login: (method = "password") => track("login", { method }),

  // ── Store, delivery and affordability touchpoints ──────────────────────
  // These are the online-to-offline signals the business needs to attribute
  // store visits and calls back to the website.

  /** Pincode entered anywhere (product page, header, checkout). */
  checkPincode: (pincode: string, deliverable: boolean, source: string) =>
    track("check_pincode", { pincode, deliverable, source }),

  /** Store locator opened, or a search run inside it. */
  viewStoreLocator: (source: string) => track("view_store_locator", { source }),

  /** A specific store was opened or selected. */
  selectStore: (opts: { storeId: string; storeName: string; city?: string; source: string }) =>
    track("select_store", {
      store_id: opts.storeId,
      store_name: opts.storeName,
      city: opts.city ?? undefined,
      source: opts.source,
    }),

  /** Directions requested for a store. */
  getDirections: (storeId: string, storeName: string) =>
    track("get_directions", { store_id: storeId, store_name: storeName }),

  /** Outbound WhatsApp click — a lead leaving for a conversation. */
  whatsappClick: (source: string, context?: Record<string, unknown>) =>
    track("whatsapp_click", { source, ...context }),

  /** Outbound phone click. */
  callClick: (source: string, phone?: string) => track("call_click", { source, phone }),

  /** EMI ladder opened on a product. */
  viewEmiOptions: (opts: { itemId: string; itemName: string; price: number }) =>
    track("view_emi_options", {
      currency: "INR",
      value: toNumber(opts.price),
      item_id: opts.itemId,
      item_name: opts.itemName,
    }),

  /** A specific EMI plan was inspected. */
  selectEmiPlan: (opts: { bank: string; tenureMonths: number; monthlyAmount: number; noCost: boolean }) =>
    track("select_emi_plan", {
      currency: "INR",
      bank: opts.bank,
      tenure_months: opts.tenureMonths,
      value: toNumber(opts.monthlyAmount),
      no_cost: opts.noCost,
    }),

  /** Home delivery vs store pickup chosen at checkout. */
  selectFulfilment: (method: "delivery" | "pickup", storeName?: string) =>
    track("select_fulfilment", { fulfilment_method: method, store_name: storeName }),

  /** Offer or coupon surfaced and clicked. */
  viewOffer: (opts: { offerId: string; offerName: string; type?: string }) =>
    track("view_offer", { offer_id: opts.offerId, offer_name: opts.offerName, offer_type: opts.type }),
}
