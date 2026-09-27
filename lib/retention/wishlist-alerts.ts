/**
 * Wishlist alerts — Strategy 5.
 *
 * Wishlists are the strongest purchase-intent signal the business holds and were
 * previously used for nothing but display. This watches the wishlisted products for
 * two events worth interrupting someone for: coming back into stock, and a
 * meaningful price fall.
 *
 * Detecting a *transition* requires remembering the previous state, so a snapshot
 * per product is kept in `wishlist_alert_state`. Without it the job could only see
 * "in stock now" and would re-alert on every run.
 */

import { getCollection, COLLECTIONS } from "@/lib/db-service"
import { sendEmail } from "@/lib/email"
import {
  COLLECTION_CUSTOMER_PROFILES,
  issueUnsubscribeToken,
  recordEvent,
} from "@/lib/customer-profile"
import { PRICE_DROP_MIN_PERCENT } from "./rules"
import { buildReminderMessage, siteOrigin } from "./messages"

const COLLECTION_ALERT_STATE = "wishlist_alert_state"
const MAX_PRODUCTS_TRACKED = 2000
const MAX_SENDS_PER_RUN = 100

export type WishlistRunResult = {
  productsTracked: number
  backInStock: number
  priceDrops: number
  sent: number
  failed: number
  skipped: { consent: number; noEmail: number; duplicate: number }
  dryRun: boolean
}

type Snapshot = { productId: string; price: number; inStock: boolean }

/**
 * Compare the current catalogue against the last snapshot and return the products
 * that just became available or just got cheaper.
 */
async function detectTransitions(): Promise<{
  backInStock: Map<string, { name: string; slug?: string }>
  priceDrops: Map<string, { name: string; slug?: string; oldPrice: number; newPrice: number }>
  snapshots: Snapshot[]
}> {
  const wishlists = await getCollection("wishlists")
  const products = await getCollection(COLLECTIONS.PRODUCTS)
  const stateCollection = await getCollection(COLLECTION_ALERT_STATE)

  // Only watch products somebody actually wishlisted.
  const wishlistDocs = await wishlists
    .find({ "items.0": { $exists: true } }, { projection: { items: 1 } })
    .limit(5000)
    .toArray()

  const wishlistedIds = new Set<string>()
  for (const doc of wishlistDocs) {
    for (const id of (doc.items as string[]) ?? []) {
      if (id) wishlistedIds.add(String(id))
    }
  }

  const backInStock = new Map<string, { name: string; slug?: string }>()
  const priceDrops = new Map<
    string,
    { name: string; slug?: string; oldPrice: number; newPrice: number }
  >()
  const snapshots: Snapshot[] = []

  if (wishlistedIds.size === 0) return { backInStock, priceDrops, snapshots }

  const { ObjectId } = await import("mongodb")
  const ids = [...wishlistedIds].slice(0, MAX_PRODUCTS_TRACKED)
  const objectIds = ids.filter((id) => /^[a-f\d]{24}$/i.test(id)).map((id) => new ObjectId(id))

  const productDocs = await products
    .find(
      { $or: [{ _id: { $in: objectIds } }, { id: { $in: ids } }] },
      { projection: { name: 1, price: 1, stock: 1, slug: 1, id: 1 } },
    )
    .limit(ids.length + 50)
    .toArray()

  const previous = new Map<string, Snapshot>()
  const stateDocs = await stateCollection
    .find({ productId: { $in: ids } })
    .limit(ids.length + 50)
    .toArray()
  for (const doc of stateDocs) {
    previous.set(String(doc.productId), {
      productId: String(doc.productId),
      price: Number(doc.price) || 0,
      inStock: Boolean(doc.inStock),
    })
  }

  for (const doc of productDocs) {
    const productId = String(doc.id ?? doc._id)
    const price = Number(doc.price) || 0
    const inStock = typeof doc.stock === "number" ? doc.stock > 0 : true
    snapshots.push({ productId, price, inStock })

    const before = previous.get(productId)
    // With no prior snapshot we only record state — alerting now would fire on
    // every wishlisted product the first time this job ever runs.
    if (!before) continue

    if (!before.inStock && inStock) {
      backInStock.set(productId, { name: String(doc.name ?? "Your item"), slug: doc.slug as string })
    }

    if (before.price > 0 && price > 0 && price < before.price) {
      const dropPct = ((before.price - price) / before.price) * 100
      if (dropPct >= PRICE_DROP_MIN_PERCENT) {
        priceDrops.set(productId, {
          name: String(doc.name ?? "Your item"),
          slug: doc.slug as string,
          oldPrice: before.price,
          newPrice: price,
        })
      }
    }
  }

  return { backInStock, priceDrops, snapshots }
}

async function saveSnapshots(snapshots: Snapshot[]): Promise<void> {
  if (snapshots.length === 0) return
  const stateCollection = await getCollection(COLLECTION_ALERT_STATE)
  const now = new Date()
  await stateCollection.bulkWrite(
    snapshots.map((s) => ({
      updateOne: {
        filter: { productId: s.productId },
        update: { $set: { ...s, updatedAt: now } },
        upsert: true,
      },
    })),
  )
}

export async function runWishlistAlerts(
  options: { dryRun?: boolean } = {},
): Promise<WishlistRunResult> {
  const dryRun = options.dryRun ?? false
  const { backInStock, priceDrops, snapshots } = await detectTransitions()

  const skipped = { consent: 0, noEmail: 0, duplicate: 0 }
  let sent = 0
  let failed = 0

  const changed = new Set<string>([...backInStock.keys(), ...priceDrops.keys()])

  if (changed.size > 0) {
    const wishlists = await getCollection("wishlists")
    const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
    const origin = siteOrigin()

    const interested = await wishlists
      .find({ items: { $in: [...changed] } }, { projection: { userId: 1, items: 1 } })
      .limit(1000)
      .toArray()

    for (const doc of interested) {
      if (sent >= MAX_SENDS_PER_RUN) break

      const userId = String(doc.userId ?? "")
      if (!userId) continue

      // One alert per customer per run, even if several wishlisted items changed.
      const hit = ((doc.items as string[]) ?? []).find((id) => changed.has(String(id)))
      if (!hit) continue

      const profile = await profiles.findOne(
        { userId },
        { projection: { email: 1, "consent.email": 1 } },
      )
      if (!profile?.consent?.email) {
        skipped.consent++
        continue
      }
      if (!profile.email) {
        skipped.noEmail++
        continue
      }

      const productId = String(hit)
      const drop = priceDrops.get(productId)
      const restock = backInStock.get(productId)
      const kind = drop ? "price_drop" : "back_in_stock"
      const info = drop ?? restock
      if (!info) continue

      if (dryRun) {
        sent++
        continue
      }

      try {
        const token = await issueUnsubscribeToken(userId)
        const message = buildReminderMessage(kind, {
          customerName: "there",
          productName: info.name,
          category: null,
          purchasedAt: new Date(),
          unsubscribeToken: token,
          actionUrl: info.slug ? `${origin}/product/${info.slug}` : `${origin}/products`,
          oldPrice: drop?.oldPrice,
          newPrice: drop?.newPrice,
        })
        if (!message) continue

        const result = await sendEmail({
          to: String(profile.email),
          subject: message.subject,
          html: message.html,
        })
        if (!result?.success) throw new Error("send failed")

        await recordEvent(userId, "reminder_sent", {
          key: `${kind}:${productId}:${new Date().toISOString().slice(0, 10)}`,
          kind,
          productId,
        })
        sent++
      } catch {
        failed++
      }
    }
  }

  // Snapshot last, so a mid-run failure re-evaluates the same transitions next time
  // rather than silently swallowing them.
  if (!dryRun) await saveSnapshots(snapshots)

  return {
    productsTracked: snapshots.length,
    backInStock: backInStock.size,
    priceDrops: priceDrops.size,
    sent,
    failed,
    skipped,
    dryRun,
  }
}
