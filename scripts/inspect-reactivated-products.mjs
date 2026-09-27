#!/usr/bin/env node
/**
 * Inspects the four products identified as previously hidden, so the evidence
 * can be judged before anything is changed. Read-only by default.
 *
 * Identified by diffing an IndexedDB cache snapshot taken at 2026-09-25T15:42Z
 * (pre-incident) against the live catalogue.
 *
 * Usage:
 *   node scripts/inspect-reactivated-products.mjs            # report only
 *   node scripts/inspect-reactivated-products.mjs --hide     # set active:false
 */
import { MongoClient, ObjectId } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

const IDS = [
  "699bdeae87e9d4fdd155d330",
  "6911afc7d1b32f695925a960",
  "6911afc7d1b32f695925a96c",
  "6911afc7d1b32f695925a971",
]

const hide = process.argv.includes("--hide")

const client = new MongoClient(uri)
await client.connect()
const col = client.db(process.env.MONGODB_DB || "e-commerce-bytewise").collection("products")

const docs = await col.find({ _id: { $in: IDS.map((id) => new ObjectId(id)) } }).toArray()

console.log(`\n  ${docs.length} of ${IDS.length} candidates found\n`)

for (const d of docs) {
  const images = Array.isArray(d.images) ? d.images.length : d.image ? 1 : 0
  const nameLooksLikeDescription = /^(key features|the drum|specifications)/i.test(String(d.name || ""))
  console.log(`  ${d._id}`)
  console.log(`    name      : ${String(d.name || "").slice(0, 72)}`)
  console.log(`    sku       : ${d.sku ?? d.SKU ?? "-"}`)
  console.log(`    price     : ${d.price ?? "-"}   mrp: ${d.mrp ?? "-"}`)
  console.log(`    images    : ${images}`)
  console.log(`    active    : ${d.active}`)
  console.log(`    createdAt : ${d.createdAt ? new Date(d.createdAt).toISOString() : "-"}`)
  console.log(`    signals   : ${[
    images === 0 ? "NO IMAGES" : null,
    !d.price ? "NO PRICE" : null,
    nameLooksLikeDescription ? "NAME IS A DESCRIPTION FRAGMENT" : null,
  ].filter(Boolean).join(", ") || "none"}`)
  console.log("")
}

if (hide) {
  const res = await col.updateMany(
    { _id: { $in: docs.map((d) => d._id) } },
    { $set: { active: false, updatedAt: new Date() } },
  )
  console.log(`  set active:false on ${res.modifiedCount} products\n`)
} else {
  console.log("  report only — re-run with --hide to restore these to active:false\n")
}

await client.close()
