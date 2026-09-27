/**
 * Create the indexes the retention programme depends on.
 *
 * Safe to re-run: createIndex is idempotent, and nothing here reads, writes or
 * deletes document data. It also adds indexes for two hot paths that were only
 * ever scanned (`orders.userId`, `users.email`).
 *
 * Usage:
 *   node --env-file=.env.local scripts/create-retention-indexes.js
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || "e-commerce-bytewise"

if (!MONGODB_URI) {
  console.error(
    "MONGODB_URI is not set. Run with: node --env-file=.env.local scripts/create-retention-indexes.js",
  )
  process.exit(1)
}

const INDEXES = [
  {
    collection: "customer_profiles",
    spec: { userId: 1 },
    options: { unique: true, name: "userId_unique" },
    why: "One rollup per customer; the upsert relies on this to stay single-document.",
  },
  {
    collection: "customer_profiles",
    spec: { unsubscribeTokenHash: 1 },
    options: { name: "unsubscribe_token" },
    why: "Unsubscribe links resolve by token hash on every click.",
  },
  {
    collection: "customer_profiles",
    spec: { "consent.email": 1 },
    options: { name: "consent_email" },
    why: "Campaign senders select contactable customers per channel.",
  },
  {
    collection: "customer_profiles",
    spec: { "consent.whatsapp": 1 },
    options: { name: "consent_whatsapp" },
    why: "Same, for the WhatsApp channel.",
  },
  {
    collection: "customer_profiles",
    spec: { tier: 1, lastOrderAt: -1 },
    options: { name: "tier_recency" },
    why: "Segmentation and win-back both query tier plus recency.",
  },
  {
    collection: "customer_profiles",
    spec: { segment: 1, "consent.email": 1 },
    options: { name: "segment_contactable" },
    why: "Win-back selects a segment filtered by email consent.",
  },
  {
    collection: "customer_events",
    spec: { type: 1, "payload.key": 1 },
    options: { name: "reminder_dedupe" },
    why: "Reminder de-duplication looks up previously sent keys.",
  },
  {
    collection: "customer_events",
    spec: { userId: 1, createdAt: -1 },
    options: { name: "user_timeline" },
    why: "Reads are always one customer's history, newest first.",
  },
  {
    collection: "customer_events",
    spec: { type: 1, createdAt: -1 },
    options: { name: "type_recency" },
    why: "Suppression checks ask 'was this customer sent X recently'.",
  },
  {
    collection: "orders",
    spec: { userId: 1, status: 1 },
    options: { name: "user_status" },
    why: "Profile rebuild scans a customer's realised orders.",
  },
  {
    collection: "users",
    spec: { email: 1 },
    options: { name: "email_lookup" },
    why: "Login path; previously an unindexed collection scan.",
  },
  {
    collection: "carts",
    spec: { updatedAt: 1, abandonmentEmailCount: 1 },
    options: { name: "cart_recovery_scan" },
    why: "Cart recovery selects stale carts under the reminder cap.",
  },
  {
    collection: "wishlists",
    spec: { items: 1 },
    options: { name: "wishlist_items" },
    why: "Stock and price alerts find everyone who wishlisted a changed product.",
  },
  {
    collection: "wishlist_alert_state",
    spec: { productId: 1 },
    options: { unique: true, name: "product_snapshot" },
    why: "One price/stock snapshot per product; the upsert depends on it.",
  },
]

async function main() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 })

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    console.log(`Connected to ${DB_NAME}\n`)

    let created = 0
    let failed = 0

    for (const { collection, spec, options, why } of INDEXES) {
      const label = `${collection}.${options.name}`
      try {
        await db.collection(collection).createIndex(spec, options)
        console.log(`  ok    ${label}\n        ${why}`)
        created++
      } catch (error) {
        console.error(`  FAIL  ${label}: ${error.message}`)
        failed++
      }
    }

    console.log(`\nDone. ${created} index(es) ensured, ${failed} failed.`)
    process.exitCode = failed > 0 ? 1 : 0
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error("Index creation failed:", error.message)
  process.exit(1)
})
