/**
 * Turns off the festive particle effect / pattern / toran on the active theme so
 * the storefront matches the approved flat design. Colours are left untouched.
 *
 * Usage:
 *   node --env-file=.env scripts/set-theme-plain.js          (report + apply)
 *   node --env-file=.env scripts/set-theme-plain.js --report (report only)
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"
const REPORT_ONLY = process.argv.includes("--report")

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/set-theme-plain.js")
  process.exit(1)
}

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const collection = client.db(DB_NAME).collection("site_theme")

  const doc = await collection.findOne({ key: "active" })
  const theme = (doc && doc.theme) || {}

  console.log("current:", JSON.stringify({
    id: theme.id,
    occasion: theme.occasion,
    effect: theme.effect,
    intensity: theme.intensity,
    pattern: theme.pattern,
    toran: theme.toran,
    announcement: theme.announcement,
  }))

  if (REPORT_ONLY) {
    await client.close()
    return
  }

  await collection.updateOne(
    { key: "active" },
    {
      $set: {
        "theme.effect": "none",
        "theme.intensity": "subtle",
        "theme.pattern": "none",
        "theme.toran": false,
        "theme.blessing": false,
        updatedAt: new Date(),
      },
    },
    { upsert: false },
  )

  console.log("effect/pattern/toran disabled — colours untouched")
  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
