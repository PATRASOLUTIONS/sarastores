/**
 * Create the indexes the storefront and checkout depend on.
 *
 * Safe to re-run: createIndex is idempotent, and nothing here reads, writes or
 * deletes document data. Without these, login, order history, cart lookup and
 * coupon validation are full collection scans.
 *
 * Usage:
 *   node --env-file=.env scripts/create-core-indexes.mjs
 */

import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/create-core-indexes.mjs")
  process.exit(1)
}

const INDEXES = [
  {
    collection: "custom_posters",
    spec: { slug: 1 },
    options: { unique: true, name: "custom_poster_slug_unique" },
    why: "Concurrent poster creation must allocate different slugs rather than overwrite artwork; reconcile existing duplicates first.",
  },
  {
    collection: "poster_settings",
    spec: { key: 1 },
    options: { unique: true, name: "poster_settings_key_unique" },
    why: "Poster publication and deletion serialize on the hero settings document.",
  },
  {
    collection: "partner_products",
    spec: { partnerId: 1, productId: 1 },
    options: { unique: true, name: "partner_product_unique" },
    why: "Partner assignment writes canonicalize native/string IDs in a serialized transaction; reconcile historical mixed-ID duplicates before applying.",
  },
  {
    collection: "store_locations",
    spec: { shopName: 1 },
    options: { unique: true, name: "store_shop_name_unique" },
    why: "Bulk store imports upsert by exact trimmed shop name; reconcile historical duplicates before applying.",
  },
  {
    collection: "store_stock",
    spec: { storeCode: 1, sku: 1 },
    options: { unique: true, name: "store_stock_store_sku_unique" },
    why: "Stock uploads upsert one row per store code and item code; checkout availability reads by both.",
  },
  {
    collection: "store_stock",
    spec: { sku: 1 },
    options: { name: "store_stock_sku" },
    why: "Recomputing a product's total stock sums every store's row for its item code.",
  },
  {
    collection: "store_qr_codes",
    spec: { storeId: 1, type: 1 },
    options: { unique: true, name: "store_qr_type_unique" },
    why: "Concurrent single/bulk QR creation requires one code per store and type; reconcile historical duplicates before applying.",
  },
  {
    collection: "campaign_pages",
    spec: { slug: 1 },
    options: { unique: true, name: "campaign_slug_unique" },
    why: "Concurrent campaign creation or rename must not publish duplicate canonical URLs; reconcile historical duplicates before applying.",
  },
  {
    collection: "rate_limits",
    spec: { resetAt: 1 },
    options: { name: "rate_limit_expiry", expireAfterSeconds: 0 },
    why: "Expired shared counters are removed automatically; the unique _id makes increments atomic.",
  },
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
    spec: { createdAt: -1 },
    options: { name: "recent" },
    why: "The admin orders list sorts every order by date. Without this it is a full collection scan plus an in-memory sort.",
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
    options: { unique: true, name: "sku_unique" },
    why: "Product detail joins and concurrent specification uploads require one record per SKU.",
  },
  {
    collection: "employees",
    spec: { employeeId: 1 },
    options: { unique: true, name: "employee_id_unique" },
    why: "Staff creation and updates must not reuse an employee identity.",
  },
  {
    collection: "employees",
    spec: { email: 1 },
    options: { unique: true, name: "employee_email_unique" },
    why: "A staff login has exactly one employee record.",
  },
  {
    collection: "blocked_pincodes",
    spec: { key: 1 },
    options: { unique: true, name: "pincode_key_unique" },
    why: "Concurrent list upserts must update the same restriction singleton.",
  },
  {
    collection: "partner_api_keys",
    spec: { hashedKey: 1 },
    options: { name: "hashed_key" },
    why: "Every partner API request authenticates by hashed key.",
  },
  {
    collection: "refresh_tokens",
    spec: { tokenHash: 1 },
    options: { unique: true, name: "token_hash_unique" },
    why: "Every mobile token refresh resolves by this hash.",
  },
  {
    collection: "refresh_tokens",
    spec: { userId: 1 },
    options: { name: "userId" },
    why: "Logout-everywhere, password reset and account deletion revoke by user.",
  },
  {
    collection: "refresh_tokens",
    spec: { familyId: 1 },
    options: { name: "familyId" },
    why: "Token-reuse detection revokes a whole rotation family at once.",
  },
  {
    collection: "refresh_tokens",
    spec: { expiresAt: 1 },
    options: { name: "ttl", expireAfterSeconds: 0 },
    why: "Rotated and expired tokens must age out; without this the collection grows forever.",
  },
  {
    collection: "device_tokens",
    spec: { token: 1 },
    options: { unique: true, name: "token_unique" },
    why: "Push registration upserts by token so a handset moves between accounts instead of duplicating.",
  },
  {
    collection: "device_tokens",
    spec: { userId: 1 },
    options: { name: "userId" },
    why: "Every push send resolves a user's devices.",
  },
  {
    collection: "customer_profiles",
    spec: { userId: 1 },
    options: { unique: true, name: "userId_unique" },
    why: "The profile is a 1:1 rollup read by findOne({userId}) on every preferences load and retention pass. Without it each read is a COLLSCAN that grows with the customer base.",
  },
  {
    collection: "customer_unsubscribe_tokens",
    spec: { userId: 1 },
    options: { name: "userId" },
    why: "Account erasure removes hash-only opt-out link verifiers by user; token lookups use the built-in unique _id index.",
  },
  {
    collection: "customer_profiles",
    spec: { unsubscribeTokenHash: 1 },
    options: { name: "unsubscribe_token", sparse: true },
    why: "Preserves legacy opt-out links issued before the hash-only token collection was introduced.",
  },
  {
    collection: "products",
    spec: { active: 1, featured: 1 },
    options: { name: "active_featured" },
    why: "The homepage requests featured products on every load; active_category cannot serve it, so Mongo scans the whole active catalogue.",
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
