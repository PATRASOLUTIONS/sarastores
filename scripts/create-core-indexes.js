/**
 * Create the indexes the storefront and checkout depend on.
 *
 * Safe to re-run: createIndex is idempotent, and nothing here reads, writes or
 * deletes document data. Without these, login, order history, cart lookup and
 * coupon validation are full collection scans.
 *
 * Usage:
 *   node --env-file=.env scripts/create-core-indexes.js
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/create-core-indexes.js")
  process.exit(1)
}

const INDEXES = [
  {
    collection: "users",
    spec: { email: 1 },
    options: { unique: true, name: "email_unique" },
    why: "Every login resolves by email; unique also blocks duplicate accounts.",
  },
  {
    collection: "orders",
    spec: { userId: 1, createdAt: -1 },
    options: { name: "user_recent" },
    why: "Order history is always filtered by user and sorted by date.",
  },
  {
    collection: "orders",
    spec: { orderId: 1 },
    options: { unique: true, name: "orderId_unique" },
    why: "Order lookup and tracking resolve by the human-readable order id.",
  },
  {
    collection: "orders",
    spec: { "coupon.code": 1 },
    options: { name: "coupon_code" },
    why: "Admin coupon usage counting scans this field.",
  },
  {
    collection: "carts",
    spec: { userId: 1 },
    options: { name: "userId" },
    why: "One cart per user; every cart read and merge hits this. Not unique yet — duplicate cart documents exist.",
  },
  {
    collection: "wishlists",
    spec: { userId: 1 },
    options: { name: "userId" },
    why: "Wishlist reads are always scoped to a user.",
  },
  {
    collection: "coupons",
    spec: { code: 1 },
    options: { unique: true, name: "code_unique" },
    why: "Coupon validation resolves by code on every checkout attempt.",
  },
  {
    collection: "products",
    spec: { sku: 1 },
    options: { name: "sku" },
    why: "SKU lookup is used by order pricing, specs and the price sync.",
  },
  {
    collection: "products",
    spec: { active: 1, category: 1 },
    options: { name: "active_category" },
    why: "Category listing pages filter on exactly this pair.",
  },
  {
    collection: "products",
    spec: { name: "text", description: "text", brand: "text" },
    options: { name: "product_search" },
    why: "Search and autocomplete currently scan every product.",
  },
  {
    collection: "product_specifications",
    spec: { sku: 1 },
    options: { name: "sku" },
    why: "Product detail pages join specifications by SKU.",
  },
  {
    collection: "partner_api_keys",
    spec: { hashedKey: 1 },
    options: { name: "hashed_key" },
    why: "Every partner API request authenticates by hashed key.",
  },
]

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  try {
    const db = client.db(DB_NAME)
    console.log(`Ensuring ${INDEXES.length} index(es) on ${DB_NAME}\n`)

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
