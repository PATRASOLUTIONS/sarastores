#!/usr/bin/env node
/**
 * Capacity analysis for the hot read paths.
 *
 * Runs explain() against the real Atlas cluster, so these numbers are
 * production-accurate even though the app server here is a dev build.
 * Read-only.
 *
 * Usage: node scripts/analyze-capacity.mjs
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

// Query, collection, and the endpoint that issues it.
const QUERIES = [
  ["products", { active: true }, { limit: 500 }, "GET /api/products (catalogue)"],
  ["products", { active: true, featured: true }, { limit: 12 }, "GET /api/products?featured=true"],
  ["products", { active: true, category: "HOME APPLIANCES" }, { limit: 60 }, "category listing"],
  ["products", { active: true, $or: [{ name: { $regex: "samsung", $options: "i" } }] }, { limit: 20 }, "search"],
  ["categories", {}, {}, "GET /api/categories"],
  ["sub_categories", {}, {}, "GET /api/sub-categories"],
  ["store_locations", { isActive: true }, {}, "GET /api/stores"],
  ["orders", {}, { limit: 50, sort: { createdAt: -1 } }, "GET /api/orders"],
  ["carts", {}, { limit: 1 }, "GET /api/cart"],
]

console.log(`\n  QUERY COST — explain() against the live cluster\n`)
console.log(`  ${"endpoint".padEnd(38)} ${"examined".padStart(9)} ${"returned".padStart(9)} ${"ms".padStart(6)}  index`)

let collscans = 0
for (const [coll, filter, opts, label] of QUERIES) {
  try {
    let cursor = db.collection(coll).find(filter)
    if (opts.sort) cursor = cursor.sort(opts.sort)
    if (opts.limit) cursor = cursor.limit(opts.limit)
    const ex = await cursor.explain("executionStats")
    const st = ex.executionStats
    const stage = JSON.stringify(ex.queryPlanner?.winningPlan ?? {})
    const idx = (stage.match(/"indexName":"([^"]+)"/) || [])[1] || (stage.includes("COLLSCAN") ? "COLLSCAN" : "-")
    if (idx === "COLLSCAN") collscans++
    console.log(
      `  ${label.padEnd(38)} ${String(st.totalDocsExamined).padStart(9)} ${String(st.nReturned).padStart(9)} ${String(st.executionTimeMillis).padStart(6)}  ${idx}`,
    )
  } catch (e) {
    console.log(`  ${label.padEnd(38)} ${"ERR".padStart(9)}  ${e.message.slice(0, 40)}`)
  }
}

// Collection sizes drive both payload weight and cache effectiveness.
console.log(`\n  COLLECTION SIZES\n`)
for (const name of ["products", "orders", "users", "carts", "categories", "store_locations"]) {
  try {
    const stats = await db.command({ collStats: name })
    const count = await db.collection(name).countDocuments({})
    console.log(
      `  ${name.padEnd(18)} docs=${String(count).padStart(6)}  data=${(stats.size / 1048576).toFixed(1)}MB  indexes=${stats.nindexes}  idxSize=${(stats.totalIndexSize / 1048576).toFixed(1)}MB`,
    )
  } catch {
    console.log(`  ${name.padEnd(18)} (unavailable)`)
  }
}

console.log(`\n  INDEXES ON products\n`)
for (const idx of await db.collection("products").indexes()) {
  console.log(`    ${idx.name.padEnd(34)} ${JSON.stringify(idx.key)}`)
}

console.log(`\n  ${collscans === 0 ? "No COLLSCAN on the hot paths." : `${collscans} hot query does a COLLSCAN.`}\n`)

await client.close()
