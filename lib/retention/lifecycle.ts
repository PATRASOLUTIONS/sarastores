/**
 * Lifecycle reminder engine — Strategies 7, 8 and 9.
 *
 * One pass computes every reminder that has fallen due, then filters it through
 * three gates before anything is sent:
 *
 *   1. Consent   — the customer has opted in to email.
 *   2. Dedupe    — this exact reminder has not been sent before.
 *   3. Frequency — the customer has not been messaged too recently.
 *
 * The engine is idempotent: reminders are derived from order dates, so a re-run
 * recomputes the same set and the dedupe gate discards everything already sent.
 * `dryRun` returns the plan without sending, which is the only safe way to inspect
 * behaviour against production data.
 */

import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { categoryOf } from "@/utils/catalog"
import { sendEmail } from "@/lib/email"
import {
  COLLECTION_CUSTOMER_PROFILES,
  COLLECTION_CUSTOMER_EVENTS,
  EARNING_STATUSES,
  issueUnsubscribeToken,
  recordEvent,
} from "@/lib/customer-profile"
import {
  ACCESSORY_DELAY_DAYS,
  CONSUMABLES,
  DEDUPE_WINDOW_DAYS,
  MAX_PRODUCT_AGE_DAYS,
  REVIEW_REQUEST_DELAY_DAYS,
  REVIEW_REQUEST_WINDOW_DAYS,
  SERVICE_INTERVAL_DAYS,
  WARRANTY_NOTICE_DAYS,
  addMonths,
  daysBetween,
  reminderKey,
  warrantyMonthsFor,
  type ReminderKind,
} from "./rules"
import { buildReminderMessage } from "./messages"
import { WINBACK_SEGMENTS, type Segment } from "./segmentation"

/** Never message the same customer more than once in this window, across all rules. */
const MIN_DAYS_BETWEEN_MESSAGES = 14

/** Bounds so one invocation cannot exceed the serverless execution limit. */
const MAX_ORDERS_SCANNED = 1000
const MAX_SENDS_PER_RUN = 100

const REMINDER_EVENT = "reminder_sent"

export type PlannedReminder = {
  key: string
  kind: ReminderKind
  userId: string
  email: string
  customerName: string
  productName: string
  category: string | null
  purchasedAt: Date
  orderId: string
  productId: string
  part?: string
  daysRemaining?: number
}

type OrderDoc = {
  _id: unknown
  userId?: string
  status?: string
  createdAt?: string | Date
  deliveredAt?: string | Date
  items?: Array<Record<string, unknown>>
  customer?: { name?: string; email?: string }
}

function toDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Order items store only id/name/price — never a category — so the taxonomy has to
 * come from the product record. Fetched in one batched query, not per item.
 */
async function loadProductCategories(
  productIds: string[],
): Promise<Map<string, { category: string | null; name: string }>> {
  const map = new Map<string, { category: string | null; name: string }>()
  if (productIds.length === 0) return map

  const products = await getCollection(COLLECTIONS.PRODUCTS)
  const { ObjectId } = await import("mongodb")

  const objectIds = productIds
    .filter((id) => /^[a-f\d]{24}$/i.test(id))
    .map((id) => new ObjectId(id))

  const docs = await products
    .find(
      { $or: [{ _id: { $in: objectIds } }, { id: { $in: productIds } }] },
      { projection: { name: 1, category: 1, subCategory: 1, id: 1 } },
    )
    .limit(productIds.length + 50)
    .toArray()

  for (const doc of docs) {
    const key = String(doc.id ?? doc._id)
    map.set(key, {
      category: categoryOf(doc as Record<string, unknown>),
      name: String(doc.name ?? "your appliance"),
    })
  }
  return map
}

/** Reminder keys already sent, so nothing is repeated. */
async function loadSentKeys(): Promise<Set<string>> {
  const events = await getCollection(COLLECTION_CUSTOMER_EVENTS)
  const since = new Date(Date.now() - DEDUPE_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const docs = await events
    .find(
      { type: REMINDER_EVENT, createdAt: { $gte: since } },
      { projection: { "payload.key": 1 } },
    )
    .limit(20000)
    .toArray()

  const keys = new Set<string>()
  for (const doc of docs) {
    const key = (doc.payload as { key?: string } | undefined)?.key
    if (key) keys.add(key)
  }
  return keys
}

/** Customers messaged too recently to receive anything else. */
async function loadRecentlyMessaged(): Promise<Set<string>> {
  const events = await getCollection(COLLECTION_CUSTOMER_EVENTS)
  const since = new Date(Date.now() - MIN_DAYS_BETWEEN_MESSAGES * 24 * 60 * 60 * 1000)
  const userIds = await events.distinct("userId", {
    type: REMINDER_EVENT,
    createdAt: { $gte: since },
  })
  return new Set(userIds.map((id) => String(id)))
}

/**
 * Reminders due from purchase history: warranty expiry, servicing, consumables and
 * the post-purchase accessory nudge.
 */
async function planOrderReminders(now: Date): Promise<PlannedReminder[]> {
  const orders = await getCollection(COLLECTIONS.ORDERS)

  const oldest = new Date(now.getTime() - MAX_PRODUCT_AGE_DAYS * 24 * 60 * 60 * 1000)
  const docs = (await orders
    .find(
      {
        status: { $in: [...EARNING_STATUSES] },
        userId: { $nin: [null, ""] },
        createdAt: { $gte: oldest },
      },
      { projection: { userId: 1, createdAt: 1, deliveredAt: 1, items: 1, customer: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(MAX_ORDERS_SCANNED)
    .toArray()) as OrderDoc[]

  const productIds = new Set<string>()
  for (const order of docs) {
    for (const item of order.items ?? []) {
      const id = item.id ?? item.productId
      if (id) productIds.add(String(id))
    }
  }
  const productMap = await loadProductCategories([...productIds])

  const planned: PlannedReminder[] = []

  for (const order of docs) {
    const userId = String(order.userId ?? "")
    const purchasedAt = toDate(order.createdAt)
    if (!userId || !purchasedAt) continue

    const orderId = String(order._id)
    const age = daysBetween(purchasedAt, now)
    const customerName = String(order.customer?.name ?? "").split(" ")[0] || "there"

    // Review timing is anchored on delivery; older orders predate that stamp and
    // fall back to the order date.
    const deliveredAt = toDate(order.deliveredAt) ?? purchasedAt
    const daysSinceDelivery = daysBetween(deliveredAt, now)

    for (const item of order.items ?? []) {
      const productId = String(item.id ?? item.productId ?? "")
      if (!productId) continue

      const product = productMap.get(productId)
      const category = product?.category ?? null
      const productName = String(item.name ?? product?.name ?? "your appliance")

      const base = {
        userId,
        email: "",
        customerName,
        productName,
        category,
        purchasedAt,
        orderId,
        productId,
      }

      // Accessory nudge — a single message, shortly after delivery.
      if (age >= ACCESSORY_DELAY_DAYS && age < ACCESSORY_DELAY_DAYS + 7) {
        planned.push({
          ...base,
          kind: "accessory",
          key: reminderKey("accessory", orderId, productId),
        })
      }

      // Review invitation — one week after the customer actually received it.
      if (
        daysSinceDelivery >= REVIEW_REQUEST_DELAY_DAYS &&
        daysSinceDelivery < REVIEW_REQUEST_DELAY_DAYS + REVIEW_REQUEST_WINDOW_DAYS
      ) {
        planned.push({
          ...base,
          kind: "review_request",
          key: reminderKey("review_request", orderId, productId),
        })
      }

      // Warranty expiry — fires once, inside the notice window before it lapses.
      const warrantyEndsAt = addMonths(purchasedAt, warrantyMonthsFor(category))
      const daysRemaining = daysBetween(now, warrantyEndsAt)
      if (daysRemaining > 0 && daysRemaining <= WARRANTY_NOTICE_DAYS) {
        planned.push({
          ...base,
          kind: "warranty_expiry",
          daysRemaining,
          key: reminderKey("warranty_expiry", orderId, productId),
        })
      }

      // Servicing — recurring; `occurrence` keeps each cycle independently deduped.
      const serviceInterval = category ? SERVICE_INTERVAL_DAYS[category] : undefined
      if (serviceInterval && age >= serviceInterval && age % serviceInterval < 7) {
        planned.push({
          ...base,
          kind: "service_due",
          key: reminderKey(
            "service_due",
            orderId,
            productId,
            Math.floor(age / serviceInterval),
          ),
        })
      }

      // Consumables — same recurring pattern, different message and intent.
      const consumable = category ? CONSUMABLES[category] : undefined
      if (consumable && age >= consumable.intervalDays && age % consumable.intervalDays < 7) {
        planned.push({
          ...base,
          kind: "replenishment",
          part: consumable.part,
          key: reminderKey(
            "replenishment",
            orderId,
            productId,
            Math.floor(age / consumable.intervalDays),
          ),
        })
      }
    }
  }

  return planned
}

/** Win-back for customers whose segment says they are drifting away. */
async function planWinbackReminders(): Promise<PlannedReminder[]> {
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const docs = await profiles
    .find(
      { segment: { $in: WINBACK_SEGMENTS as Segment[] }, "consent.email": true },
      { projection: { userId: 1, email: 1, lastOrderAt: 1, segment: 1 } },
    )
    .limit(200)
    .toArray()

  const now = new Date()
  return docs
    .filter((doc) => doc.email)
    .map((doc) => {
      const userId = String(doc.userId)
      // Monthly cadence at most — the occurrence index makes that automatic.
      const occurrence = Math.floor(now.getTime() / (30 * 24 * 60 * 60 * 1000))
      return {
        key: reminderKey("winback", userId, String(doc.segment), occurrence),
        kind: "winback" as ReminderKind,
        userId,
        email: String(doc.email),
        customerName: "there",
        productName: "",
        category: null,
        purchasedAt: toDate(doc.lastOrderAt) ?? now,
        orderId: "",
        productId: String(doc.segment),
      }
    })
}

export type RunResult = {
  planned: number
  eligible: number
  sent: number
  failed: number
  skipped: { consent: number; duplicate: number; frequency: number; noEmail: number }
  dryRun: boolean
  breakdown: Record<string, number>
}

export async function runLifecycleReminders(options: { dryRun?: boolean } = {}): Promise<RunResult> {
  const dryRun = options.dryRun ?? false
  const now = new Date()

  const [orderReminders, winbacks, sentKeys, recentlyMessaged] = await Promise.all([
    planOrderReminders(now),
    planWinbackReminders(),
    loadSentKeys(),
    loadRecentlyMessaged(),
  ])

  const planned = [...orderReminders, ...winbacks]
  const skipped = { consent: 0, duplicate: 0, frequency: 0, noEmail: 0 }

  // Consent is authoritative and lives on the profile, not the order.
  const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
  const userIds = [...new Set(planned.map((p) => p.userId))]
  const profileDocs = await profiles
    .find(
      { userId: { $in: userIds } },
      { projection: { userId: 1, email: 1, "consent.email": 1 } },
    )
    .limit(userIds.length + 10)
    .toArray()

  const consentMap = new Map<string, { email: string | null; allowed: boolean }>()
  for (const doc of profileDocs) {
    consentMap.set(String(doc.userId), {
      email: (doc.email as string) ?? null,
      allowed: Boolean((doc.consent as { email?: boolean } | undefined)?.email),
    })
  }

  const eligible: PlannedReminder[] = []
  const seenThisRun = new Set<string>()

  for (const reminder of planned) {
    if (sentKeys.has(reminder.key) || seenThisRun.has(reminder.key)) {
      skipped.duplicate++
      continue
    }
    if (recentlyMessaged.has(reminder.userId)) {
      skipped.frequency++
      continue
    }

    const profile = consentMap.get(reminder.userId)
    if (!profile?.allowed) {
      skipped.consent++
      continue
    }

    const email = reminder.email || profile.email
    if (!email) {
      skipped.noEmail++
      continue
    }

    seenThisRun.add(reminder.key)
    // One message per customer per run keeps the frequency promise true.
    if (eligible.some((e) => e.userId === reminder.userId)) continue
    eligible.push({ ...reminder, email })

    if (eligible.length >= MAX_SENDS_PER_RUN) break
  }

  const breakdown: Record<string, number> = {}
  for (const item of eligible) {
    breakdown[item.kind] = (breakdown[item.kind] ?? 0) + 1
  }

  if (dryRun) {
    return {
      planned: planned.length,
      eligible: eligible.length,
      sent: 0,
      failed: 0,
      skipped,
      dryRun: true,
      breakdown,
    }
  }

  let sent = 0
  let failed = 0

  for (const reminder of eligible) {
    try {
      // Rotating the token per send means a leaked link expires on the next message.
      const token = await issueUnsubscribeToken(reminder.userId)
      const message = buildReminderMessage(reminder.kind, {
        customerName: reminder.customerName,
        productName: reminder.productName,
        category: reminder.category,
        purchasedAt: reminder.purchasedAt,
        unsubscribeToken: token,
        part: reminder.part,
        daysRemaining: reminder.daysRemaining,
      })
      if (!message) continue

      const result = await sendEmail({
        to: reminder.email,
        subject: message.subject,
        html: message.html,
      })

      if (!result?.success) throw new Error("send failed")

      await recordEvent(reminder.userId, REMINDER_EVENT, {
        key: reminder.key,
        kind: reminder.kind,
        orderId: reminder.orderId,
        productId: reminder.productId,
      })
      sent++
    } catch {
      // One bad address must not abort the batch.
      failed++
    }
  }

  return {
    planned: planned.length,
    eligible: eligible.length,
    sent,
    failed,
    skipped,
    dryRun: false,
    breakdown,
  }
}
