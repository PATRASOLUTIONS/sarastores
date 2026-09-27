#!/usr/bin/env node
/**
 * Read-only: reports the `active` flag distribution on products, to assess the
 * blast radius of the accidental activate-all on 2026-09-25 18:03Z.
 *
 * Usage: node scripts/check-product-active-flag.mjs
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

const total = await col.countDocuments({})
const activeTrue = await col.countDocuments({ active: true })
const activeFalse = await col.countDocuments({ active: false })
const activeMissing = await col.countDocuments({ active: { $exists: false } })

console.log(`\n  products total       : ${total}`)
console.log(`    active: true       : ${activeTrue}`)
console.log(`    active: false      : ${activeFalse}`)
console.log(`    active missing     : ${activeMissing}`)

// A product hidden from the storefront would normally be active:false.
// If that count is 0 and every row was just touched, the flag was overwritten.
console.log(`\n  Storefront visibility is driven by \`active\`.`)
console.log(`  ${activeFalse === 0 ? "No product is currently hidden." : `${activeFalse} products remain hidden.`}\n`)

await client.close()
