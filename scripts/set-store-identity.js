/**
 * Sets the store identity fields used across metadata, JSON-LD and the footer.
 *
 * Previous values are written to archive/branding/ before being replaced.
 *
 * Usage:
 *   node --env-file=.env scripts/set-store-identity.js
 */

const { MongoClient } = require("mongodb")
const fs = require("node:fs")
const path = require("node:path")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"

const IDENTITY = {
  storeName: "SARA Mobiles & Electronics",
  legalName: "SARA Mobiles Pvt. Ltd.",
  statYears: "25+",
  statStores: "85+",
  statCustomers: "2,00,000+",
}

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/set-store-identity.js")
  process.exit(1)
}

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const settings = client.db(DB_NAME).collection("settings")

  const doc = await settings.findOne({})
  if (!doc) {
    console.error("No settings document found.")
    process.exit(1)
  }

  const archiveDir = path.resolve("archive/branding")
  fs.mkdirSync(archiveDir, { recursive: true })
  fs.writeFileSync(
    path.join(archiveDir, "old-store-identity.json"),
    JSON.stringify({ storeName: doc.storeName ?? null, legalName: doc.legalName ?? null }, null, 2),
  )

  await settings.updateOne({ _id: doc._id }, { $set: { ...IDENTITY, updatedAt: new Date() } })
  for (const [key, value] of Object.entries(IDENTITY)) console.log(`${key.padEnd(14)} → ${value}`)

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
