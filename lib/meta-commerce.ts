"use client"

import { hasConsent, CONSENT_CHANGE_EVENT } from "@/lib/consent-client"

export const META_READY_EVENT = "sara:meta-ready"
type Pixel = (command: "track", event: string, params: Record<string, unknown>, options?: { eventID: string }) => void
declare global { interface Window { fbq?: Pixel } }
type Dispatch = { event: string; params: Record<string, unknown>; eventID?: string }
const names: Record<string, string> = {
  view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout",
  add_payment_info: "AddPaymentInfo", purchase: "Purchase", generate_lead: "Lead", sign_up: "CompleteRegistration",
}
const pending: Dispatch[] = [], purchases = new Set<string>()
let listening = false

function dispatched(id: string): boolean {
  if (purchases.has(id)) return true
  try { return sessionStorage.getItem(`sara:meta:${id}`) === "sent" } catch { return false }
}

function emit(value: Dispatch) {
  if (!hasConsent("advertising") || typeof window.fbq !== "function") return false
  if (value.eventID && dispatched(value.eventID)) return true
  try {
    window.fbq("track", value.event, value.params, value.eventID ? { eventID: value.eventID } : undefined)
    if (value.eventID) {
      purchases.add(value.eventID)
      if (purchases.size > 500) purchases.delete(purchases.values().next().value!)
      try { sessionStorage.setItem(`sara:meta:${value.eventID}`, "sent") } catch { /* In-memory protection remains available. */ }
    }
    return true
  } catch { return false }
}

function flush() {
  if (!hasConsent("advertising")) { pending.length = 0; return }
  if (typeof window.fbq !== "function") return
  for (const value of pending.splice(0)) emit(value)
}

/** Existing browser pixel only. Never forward contact fields or arbitrary analytics params. */
export function trackMetaCommerce(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_META_PIXEL_ID) return
  if (!hasConsent("advertising")) { pending.length = 0; return }
  const name = names[event]
  if (!name) return
  const contents = Array.isArray(params.items) ? params.items.slice(0, 40).flatMap(item => {
    if (!item || typeof item !== "object") return []
    const entry = item as Record<string, unknown>, id = entry.item_id
    const quantity = Number(entry.quantity ?? 1), price = Number(entry.price)
    if (typeof id !== "string" || !id || id.length > 200 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) return []
    return [{ id, quantity, ...(Number.isFinite(price) && price >= 0 ? { item_price: price } : {}) }]
  }) : []
  const money = Number(params.value)
  const data: Record<string, unknown> = contents.length ? {
    content_type: "product", content_ids: contents.map(item => item.id), contents,
    num_items: contents.reduce((total, item) => total + item.quantity, 0),
  } : {}
  if (Number.isFinite(money) && money >= 0 && params.value != null) Object.assign(data, { value: money, currency: "INR" })
  let eventID: string | undefined
  if (event === "purchase") {
    if (!contents.length || params.value == null || !Number.isFinite(money) || money < 0 ||
      (params.currency != null && params.currency !== "INR") || typeof params.transaction_id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(params.transaction_id)) return
    eventID = `order-${params.transaction_id}`
    if (dispatched(eventID) || pending.some(value => value.eventID === eventID)) return
  } else if (["view_item", "add_to_cart", "begin_checkout", "add_payment_info"].includes(event) && !contents.length) return
  const value: Dispatch = { event: name, params: data, eventID }
  if (emit(value)) return
  // Consent-gated script initialization can follow a product's first effect.
  // Queue locally until the existing pixel stub is ready; no polling/network work.
  if (!listening) {
    listening = true
    window.addEventListener(META_READY_EVENT, flush)
    window.addEventListener(CONSENT_CHANGE_EVENT, flush)
  }
  if (pending.length >= 30) pending.shift()
  pending.push(value)
}
