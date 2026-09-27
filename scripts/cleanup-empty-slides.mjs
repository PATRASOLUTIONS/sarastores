#!/usr/bin/env node
/**
 * One-off cleanup: removes the empty product_slides document created by an
 * empty-body POST during guard verification on 2026-09-25.
 *
 * Deletes ONLY documents that carry no content fields (just _id/createdAt/
 * updatedAt), so a real slide can never be removed by running this.
 *
 * Usage: node scripts/cleanup-empty-slides.mjs [--apply]
 */
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

const apply = process.argv.includes("--apply")
const CONTENT_FIELDS = ["title", "subtitle", "image", "link", "productId", "products", "name", "order", "active"]

const client = new MongoClient(uri)
await client.connect()
const db = client.db(process.env.MONGODB_DB || "e-commerce-bytewise")
const col = db.collection("product_slides")

const all = await col.find({}).toArray()
const empty = all.filter((doc) => !CONTENT_FIELDS.some((f) => doc[f] !== undefined && doc[f] !== null && doc[f] !== ""))

console.log(`\n  product_slides documents : ${all.length}`)
console.log(`  with no content fields   : ${empty.length}\n`)
for (const doc of empty) {
  console.log(`    ${doc._id}  keys=[${Object.keys(doc).join(", ")}]`)
}

if (!empty.length) {
  console.log("\n  nothing to clean\n")
} else if (apply) {
  const res = await col.deleteMany({ _id: { $in: empty.map((d) => d._id) } })
  console.log(`\n  deleted ${res.deletedCount}\n`)
} else {
  console.log("\n  dry run — re-run with --apply to delete\n")
}

await client.close()
