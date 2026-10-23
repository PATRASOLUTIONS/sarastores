import { ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { sendEmail } from "@/lib/email"
import { escapeHtml } from "@/lib/html"
import { normaliseIndianPhone } from "@/lib/marketing/whatsapp"
import { sendWhatsAppTemplate } from "@/lib/whatsapp-template"
import { storePaymentPlatformLabel, StorePaymentWhatsAppSettingsSchema, type StorePaymentWhatsAppSettings } from "@/types/store-payment"

export const STORE_PAYMENT_REQUEST_TTL_MS = 24 * 60 * 60 * 1000
export const STORE_PAYMENT_SETTINGS_COLLECTION = "store_payment_settings"
export const STORE_PAYMENT_WHATSAPP_SETTINGS_ID = "whatsapp"

export async function getStorePaymentWhatsAppSettings(): Promise<StorePaymentWhatsAppSettings> {
  const doc = await (await getCollection<{ _id: string } & Partial<Record<keyof StorePaymentWhatsAppSettings, unknown>>>(STORE_PAYMENT_SETTINGS_COLLECTION))
    .findOne({ _id: STORE_PAYMENT_WHATSAPP_SETTINGS_ID })
  const parsed = StorePaymentWhatsAppSettingsSchema.safeParse({
    notifyStoreManager: doc?.notifyStoreManager ?? true,
    storeManagers: doc?.storeManagers ?? {},
    platformManagers: doc?.platformManagers ?? [],
  })
  if (!parsed.success) console.error("[Store payment] Stored WhatsApp settings are invalid; using defaults")
  return parsed.success ? parsed.data : { notifyStoreManager: true, storeManagers: {}, platformManagers: [] }
}

export interface PaymentStore {
  id: string
  name: string
  /** 10-digit mobile number, or "" when the store has none on record. */
  phone: string
  email: string
  address: string
}

export interface StorePaymentSummary {
  orderId: string
  customer: { name: string; phone: string; email: string }
  delivery: string
  items: Array<{ name: string; quantity: number; price: number }>
  /** Human-readable coupon / reward lines; empty when no offer applies. */
  offers?: string[]
  total: number
}

export interface StorePaymentRecipients {
  notifyStoreManager: boolean
  platformManagers: Array<{ name: string; phone: string }>
}

const rupees = (value: number) => `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`

/** WhatsApp rejects template parameters containing newlines, tabs or long space runs. */
function templateText(value: string, max = 700): string {
  const flat = value.replace(/\s+/g, " ").trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat || "-"
}

export function firstMobile(raw: unknown): string {
  for (const part of String(raw || "").split(/[,/;|]/)) {
    const normalised = normaliseIndianPhone(part)
    if (normalised) return normalised.slice(2)
  }
  return ""
}

export async function loadPaymentStore(storeId: string): Promise<PaymentStore | null> {
  if (!ObjectId.isValid(storeId)) return null
  const store = await (await getCollection("store_locations")).findOne({ _id: new ObjectId(storeId), isActive: true })
  if (!store) return null
  const managers = (await getStorePaymentWhatsAppSettings()).storeManagers
  return {
    id: store._id.toString(),
    name: String(store.shopName || "SARA store"),
    phone: managers[store._id.toString()] || firstMobile(store.mobileNo),
    email: typeof store.emailId === "string" && /^\S+@\S+\.\S+$/.test(store.emailId.trim()) ? store.emailId.trim().toLowerCase() : "",
    address: String(store.locationDescription || ""),
  }
}

function sendTemplate(phone: string, name: string, values: string[], label: string) {
  return sendWhatsAppTemplate(phone, {
    language: { policy: "deterministic", code: process.env.STORE_ORDER_WHATSAPP_LANGUAGE?.trim() || "en" },
    name,
    components: [{ type: "body", parameters: values.map(text => ({ type: "text" as const, text: templateText(text) })) }],
  }, undefined, label)
}

function itemsLine(items: StorePaymentSummary["items"]): string {
  return items.map(item => `${item.name} x${item.quantity} (${rupees(item.price * item.quantity)})`).join("; ")
}

/**
 * Tells the chosen store manager and every platform manager that a customer wants to
 * pay through the store. Each audience has its own Meta-approved AskEva template:
 *
 * STORE_ORDER_WHATSAPP_TEMPLATE, eight body variables: order ID, customer name,
 * customer phone, customer email, items, offers applied, delivery details, amount.
 *
 * PLATFORM_MANAGER_WHATSAPP_TEMPLATE, nine body variables: order ID, store name,
 * customer name, customer phone, customer email, items, offers applied, delivery
 * details, amount.
 *
 * The store email is always attempted as well so the request is not lost while a
 * template is pending approval.
 */
export async function notifyStoreOfPaymentRequest(
  store: PaymentStore,
  summary: StorePaymentSummary,
  recipients: StorePaymentRecipients = { notifyStoreManager: true, platformManagers: [] },
) {
  const storeTemplate = process.env.STORE_ORDER_WHATSAPP_TEMPLATE?.trim()
  const managerTemplate = process.env.PLATFORM_MANAGER_WHATSAPP_TEMPLATE?.trim()
  const offers = summary.offers?.length ? summary.offers.join("; ") : "None"
  const customerParams = [summary.customer.name, summary.customer.phone, summary.customer.email || "-"]
  const orderParams = [itemsLine(summary.items), offers, summary.delivery, rupees(summary.total)]

  let whatsapp = false
  let managers = 0
  const storePhone = recipients.notifyStoreManager ? store.phone : ""
  if (storePhone && storeTemplate) {
    whatsapp = (await sendTemplate(storePhone, storeTemplate,
      [summary.orderId, ...customerParams, ...orderParams], "Store payment WhatsApp")).success
  } else if (storePhone) {
    console.error("[Store payment] STORE_ORDER_WHATSAPP_TEMPLATE is not set; WhatsApp to the store was skipped")
  }
  const others = recipients.platformManagers.filter(manager => manager.phone !== storePhone)
  if (others.length && managerTemplate) {
    const results = await Promise.all(others.map(manager => sendTemplate(manager.phone, managerTemplate,
      [summary.orderId, store.name, ...customerParams, ...orderParams], "Platform manager WhatsApp")))
    managers = results.filter(result => result.success).length
  } else if (others.length) {
    console.error("[Store payment] PLATFORM_MANAGER_WHATSAPP_TEMPLATE is not set; WhatsApp to platform managers was skipped")
  }

  let email = false
  if (store.email) {
    const rows = summary.items.map(item =>
      `<tr><td>${escapeHtml(item.name)}</td><td align="center">${item.quantity}</td><td align="right">${escapeHtml(rupees(item.price * item.quantity))}</td></tr>`).join("")
    const result = await sendEmail({
      to: store.email,
      subject: `Pay at store request - ${summary.orderId}`,
      html: `<h2>New pay-at-store order request</h2>` +
        `<p>Please call the customer and send them a payment link on WhatsApp.</p>` +
        `<p><strong>Order:</strong> ${escapeHtml(summary.orderId)}<br>` +
        `<strong>Customer:</strong> ${escapeHtml(summary.customer.name)}<br>` +
        `<strong>Phone:</strong> ${escapeHtml(summary.customer.phone)}<br>` +
        `<strong>Email:</strong> ${escapeHtml(summary.customer.email)}</p>` +
        `<p><strong>Delivery:</strong> ${escapeHtml(summary.delivery)}</p>` +
        `<table cellpadding="6" border="1" style="border-collapse:collapse"><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>${rows}</table>` +
        `<p><strong>Offers:</strong> ${escapeHtml(offers)}</p>` +
        `<p><strong>Amount to collect:</strong> ${escapeHtml(rupees(summary.total))}</p>`,
    })
    email = result.success
  }
  return { whatsapp, email, managers }
}

/** Confirmation for the store staff once an administrator approves the payment. */
export async function sendStorePaymentApprovedEmail(order: {
  orderId?: string
  total?: number
  customer?: { name?: string; phone?: string | null }
  storePayment?: { storeName?: string; storeEmail?: string; platform?: string; transactionId?: string }
}, approver: { name: string; email: string }) {
  const to = order.storePayment?.storeEmail
  if (!to) return { status: "skipped" as const }
  const result = await sendEmail({
    to,
    subject: `Store payment confirmed - ${order.orderId ?? ""}`,
    html: `<h2>Store payment confirmed</h2>` +
      `<p>Order <strong>${escapeHtml(order.orderId)}</strong> paid at ${escapeHtml(order.storePayment?.storeName)} has been approved and is now being processed.</p>` +
      `<p><strong>Customer:</strong> ${escapeHtml(order.customer?.name)} (${escapeHtml(order.customer?.phone ?? "")})<br>` +
      `<strong>Amount:</strong> ${escapeHtml(rupees(Number(order.total) || 0))}<br>` +
      `<strong>Paid via:</strong> ${escapeHtml(storePaymentPlatformLabel(order.storePayment?.platform))}<br>` +
      `<strong>Transaction ID:</strong> ${escapeHtml(order.storePayment?.transactionId)}</p>` +
      `<p>Approved by ${escapeHtml(approver.name || approver.email)} (${escapeHtml(approver.email)}).</p>`,
  })
  return { status: result.success ? "sent" as const : "failed" as const }
}

type ConfirmedOrder = {
  orderId?: string
  total?: number
  items?: unknown[]
  customer?: { name?: string; phone?: string | null; address?: unknown; city?: string; state?: string; zipCode?: string }
  fulfilment?: unknown
  storePayment?: { storeName?: string; platform?: string; transactionId?: string }
}

function confirmedDelivery(order: ConfirmedOrder): string {
  const fulfilment = order.fulfilment as { method?: string; storeName?: string } | undefined
  if (fulfilment?.method === "pickup") return `Pickup from ${fulfilment.storeName || order.storePayment?.storeName || "the store"}`
  const customer = order.customer ?? {}
  const address = typeof customer.address === "string" ? customer.address
    : customer.address && typeof customer.address === "object"
      ? Object.values(customer.address as Record<string, unknown>).filter(value => typeof value === "string" && value).join(", ")
      : ""
  return `Delivery to ${[address, customer.city, customer.state, customer.zipCode].filter(Boolean).join(", ") || "your address"}`
}

/**
 * Tells the customer their pay-at-store order is confirmed. Uses the Meta-approved
 * AskEva template named by CUSTOMER_ORDER_CONFIRMED_WHATSAPP_TEMPLATE whose body takes
 * six variables in this order: customer name, order ID, items, amount paid, payment
 * (platform, transaction ID and store), delivery or pickup details.
 */
export async function sendStorePaymentConfirmedWhatsApp(order: ConfirmedOrder) {
  const template = process.env.CUSTOMER_ORDER_CONFIRMED_WHATSAPP_TEMPLATE?.trim()
  const phone = normaliseIndianPhone(String(order.customer?.phone || ""))
  if (!template) {
    console.error("[Store payment] CUSTOMER_ORDER_CONFIRMED_WHATSAPP_TEMPLATE is not set; customer WhatsApp was skipped")
    return { status: "skipped" as const }
  }
  if (!phone) return { status: "skipped" as const }
  const items = (order.items ?? []).map(raw => {
    const item = raw as { name?: string; quantity?: number; price?: number }
    return { name: String(item.name || "Item"), quantity: Number(item.quantity) || 1, price: Number(item.price) || 0 }
  })
  const payment = `${storePaymentPlatformLabel(order.storePayment?.platform)}, txn ${order.storePayment?.transactionId || "-"}, ` +
    `at ${order.storePayment?.storeName || "SARA store"}`
  const result = await sendTemplate(phone.slice(2), template, [
    order.customer?.name || "Customer", String(order.orderId || ""), itemsLine(items),
    rupees(Number(order.total) || 0), payment, confirmedDelivery(order),
  ], "Customer confirmation WhatsApp")
  return { status: result.success ? "sent" as const : "failed" as const }
}
