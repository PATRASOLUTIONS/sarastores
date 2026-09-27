/**
 * Copies content-only collections from the dev cluster to production.
 *
 * Insert-only: an existing production document is never updated or deleted.
 * Dry run unless --apply is passed. Source/target URIs come from .env.
 */
import fs from "node:fs"
import { MongoClient } from "mongodb"

const APPLY = process.argv.includes("--apply")
const DB = "e-commerce-bytewise"

// Collections approved for copying.
const ALLOW = ["brands", "email_templates", "listing_banners", "poster_settings"]

// Anything product- or order-derived must never be written by this script.
const DENY = [
  "products", "product_specifications", "product_advertisements", "categories", "sub_categories",
  "orders", "counters", "payments", "external_orders", "carts", "wishlists", "compare", "reviews",
  "users", "customer_profiles", "customer_events", "employees", "settings", "footer",
  "license_keys", "software_licenses", "software_products", "store_locations", "store_qr_codes",
  "coupons", "offers", "campaign_history", "partners", "partner_products", "partner_orders",
]
const collision = ALLOW.filter((c) => DENY.includes(c))
if (collision.length) {
  console.error("Refusing to run: protected collection in allow-list:", collision.join(", "))
  process.exit(1)
}

const env = fs.readFileSync(".env", "utf8")
const SOURCE = env.match(/^\s*MONGODB_URI\s*=\s*(mongodb\+srv:\/\/\S+)/m)?.[1].trim()
const TARGET = env.match(/^\s*#?\s*MONGODB_URI\s*=\s*(mongodb\+srv:\/\/\S*ottplay\S+)/m)?.[1].trim()
if (!SOURCE || !TARGET || SOURCE === TARGET) {
  console.error("Could not resolve two distinct cluster URIs from .env")
  process.exit(1)
}

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ")

async function open(uri) {
  const c = new MongoClient(uri, { serverSelectionTimeoutMS: 20000 })
  await c.connect()
  return { c, db: c.db(DB) }
}

const src = await open(SOURCE)
const dst = await open(TARGET)

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN (no writes) — pass --apply to execute ===")
console.log(`source: ${(SOURCE.match(/@([^.]+)\./) || [])[1]}   target: ${(TARGET.match(/@([^.]+)\./) || [])[1]}   db: ${DB}\n`)

let totalInserted = 0
let totalSkipped = 0

for (const name of ALLOW) {
  const docs = await src.db.collection(name).find({}).toArray()
  const target = dst.db.collection(name)
  const existing = await target.find({}).toArray()

  // brands are keyed on slug/name so an existing prod brand is never duplicated
  const existingKeys = new Set(
    existing.map((d) => (name === "brands" ? norm(d.slug || d.name) : String(d._id)))
  )

  let inserted = 0
  let skipped = 0
  const skippedNames = []

  for (const doc of docs) {
    const key = name === "brands" ? norm(doc.slug || doc.name) : String(doc._id)
    if (existingKeys.has(key)) {
      skipped++
      skippedNames.push(doc.name || doc.title || key)
      continue
    }
    if (APPLY) {
      await target.updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true })
    }
    inserted++
  }

  totalInserted += inserted
  totalSkipped += skipped
  console.log(
    `${name.padEnd(20)} source=${String(docs.length).padStart(3)}  prod_before=${String(existing.length).padStart(3)}  ` +
      `${APPLY ? "inserted" : "would insert"}=${String(inserted).padStart(3)}  skipped=${skipped}` +
      (skippedNames.length ? `  (${skippedNames.join(", ")})` : "")
  )
}

console.log(`\n${APPLY ? "inserted" : "would insert"}: ${totalInserted} documents, skipped ${totalSkipped} already present`)

if (APPLY) {
  console.log("\n--- verification ---")
  for (const name of ALLOW) {
    console.log(`  ${name.padEnd(20)} prod now has ${await dst.db.collection(name).countDocuments()}`)
  }
  for (const name of ["products", "orders", "users", "store_locations"]) {
    console.log(`  ${name.padEnd(20)} untouched: ${await dst.db.collection(name).countDocuments()}`)
  }
}

await src.c.close()
await dst.c.close()
