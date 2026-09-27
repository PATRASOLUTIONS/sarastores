#!/usr/bin/env node
/**
 * Follow-up to analyze-capacity: checks the per-user lookups that grow with
 * traffic (cart, wishlist, sessions) and the featured-products query.
 * Read-only.
 *
 * Usage: node scripts/analyze-hot-lookups.mjs
 */
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || "e-commerce-bytewise")

console.log("\n  PER-USER LOOKUPS (these scale with concurrent users)\n")

for (const name of ["carts", "wishlists", "refresh_tokens", "customer_profiles", "device_tokens"]) {
  try {
    const idx = await db.collection(name).indexes()
    const count = await db.collection(name).countDocuments({})
    console.log(`  ${name}  (${count} docs)`)
    for (const i of idx) console.log(`      ${i.name.padEnd(30)} ${JSON.stringify(i.key)}`)

    // The lookup every authenticated request performs.
    const probe = name === "refresh_tokens" ? { tokenHash: "x" } : { userId: "000000000000000000000000" }
    const ex = await db.collection(name).find(probe).limit(1).explain("executionStats")
    const plan = JSON.stringify(ex.queryPlanner?.winningPlan ?? {})
    const usedIdx = (plan.match(/"indexName":"([^"]+)"/) || [])[1] || (plan.includes("COLLSCAN") ? "COLLSCAN" : "-")
    console.log(`      lookup by key -> ${usedIdx}  (examined ${ex.executionStats.totalDocsExamined})`)
    console.log("")
  } catch (e) {
    console.log(`  ${name}: ${e.message.slice(0, 60)}\n`)
  }
}

console.log("  FEATURED PRODUCTS\n")
const featured = await db.collection("products").countDocuments({ featured: true })
const activeFeatured = await db.collection("products").countDocuments({ featured: true, active: true })
const hasField = await db.collection("products").countDocuments({ featured: { $exists: true } })
console.log(`    featured: true            : ${featured}`)
console.log(`    featured AND active       : ${activeFeatured}`)
console.log(`    documents with the field  : ${hasField}`)
if (activeFeatured === 0) {
  console.log(`\n    >> The homepage calls /api/products?featured=true&limit=12 on every load.`)
  console.log(`       Mongo examines all 960 active products and returns nothing,`)
  console.log(`       because no product is flagged featured.\n`)
}

console.log("  TEXT INDEX USAGE\n")
const textIdx = (await db.collection("products").indexes()).find((i) => i.name === "product_search")
console.log(`    product_search exists     : ${Boolean(textIdx)}`)
console.log(`    but /api/products?search= uses a $regex scan, so the text index is never used.`)
const regexEx = await db
  .collection("products")
  .find({ active: true, name: { $regex: "samsung", $options: "i" } })
  .limit(20)
  .explain("executionStats")
console.log(`    regex search examined     : ${regexEx.executionStats.totalDocsExamined} docs to return ${regexEx.executionStats.nReturned}`)

await client.close()
console.log("")
