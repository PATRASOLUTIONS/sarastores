#!/usr/bin/env node
/**
 * Reports product active/inactive counts and how many rows were touched by the
 * accidental activate-all during guard verification on 2026-09-25 18:03Z.
 *
 * Read-only.
 *
 * Usage: node scripts/check-product-active-state.mjs
 */
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const col = client.db(process.env.MONGODB_DB || "e-commerce-bytewise").collection("products")

const since = new Date("2026-09-25T18:03:00Z")

const total = await col.countDocuments({})
const active = await col.countDocuments({ isActive: true })
const inactive = await col.countDocuments({ isActive: false })
const missing = await col.countDocuments({ isActive: { $exists: false } })
const touched = await col.countDocuments({ updatedAt: { $gte: since } })

console.log(`\n  products total        : ${total}`)
console.log(`    isActive: true      : ${active}`)
console.log(`    isActive: false     : ${inactive}`)
console.log(`    isActive missing    : ${missing}`)
console.log(`\n  updated at/after ${since.toISOString()} : ${touched}`)

if (touched > 0) {
  const sample = await col
    .find({ updatedAt: { $gte: since } }, { projection: { name: 1, isActive: 1, updatedAt: 1 } })
    .limit(5)
    .toArray()
  console.log("\n  sample of touched rows:")
  for (const d of sample) {
    console.log(`    ${String(d.name).slice(0, 58).padEnd(60)} isActive=${d.isActive}`)
  }
}
console.log("")

await client.close()
