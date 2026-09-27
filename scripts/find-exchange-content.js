/**
 * Reports any customer-facing "exchange" copy left in the database.
 *
 * Read-only. Usage:
 *   node --env-file=.env scripts/find-exchange-content.js
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"

const COLLECTIONS = [
  "offers",
  "advertisements",
  "product_advertisements",
  "listing_banners",
  "hero_slides",
  "home_components",
  "site_features",
  "split_cards",
  "animated_banners",
  "testimonials",
  "campaign_pages",
  "email_templates",
  "settings",
  "footer",
]

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/find-exchange-content.js")
  process.exit(1)
}

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db(DB_NAME)

  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name))
  let total = 0

  for (const name of COLLECTIONS) {
    if (!existing.has(name)) continue
    const docs = await db.collection(name).find({}).toArray()
    for (const doc of docs) {
      const hits = Object.entries(doc).filter(
        ([key, value]) => key !== "_id" && typeof value === "string" && /exchang|buyback|trade[- ]?in/i.test(value),
      )
      if (hits.length > 0) {
        total += hits.length
        console.log(`\n${name} / ${doc._id}`)
        for (const [key, value] of hits) console.log(`  ${key}: ${String(value).slice(0, 160)}`)
      }
    }
  }

  console.log(total === 0 ? "\nNo exchange copy found in the database." : `\n${total} field(s) found.`)
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
