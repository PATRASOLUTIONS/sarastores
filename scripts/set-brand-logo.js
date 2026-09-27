/**
 * Points settings.brandLogo at the new /sara-logo.png asset.
 *
 * The previous value is a ~900 KB base64 data URI, so it is written to
 * archive/branding/ before being replaced — restore from there to undo.
 *
 * Usage:
 *   node --env-file=.env scripts/set-brand-logo.js
 */

const { MongoClient } = require("mongodb")
const fs = require("node:fs")
const path = require("node:path")

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise"
const NEW_LOGO = "/sara-logo.png"

if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with: node --env-file=.env scripts/set-brand-logo.js")
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

  if (doc.brandLogo === NEW_LOGO) {
    console.log("brandLogo already points at the new logo — nothing to do.")
    await client.close()
    return
  }

  const archiveDir = path.resolve("archive/branding")
  fs.mkdirSync(archiveDir, { recursive: true })

  if (typeof doc.brandLogo === "string" && doc.brandLogo.startsWith("data:")) {
    const [, mime, b64] = doc.brandLogo.match(/^data:([^;]+);base64,(.*)$/s) || []
    const ext = (mime || "image/png").split("/")[1].replace("+xml", "")
    const file = path.join(archiveDir, `old-brand-logo.${ext}`)
    fs.writeFileSync(file, Buffer.from(b64 || "", "base64"))
    console.log(`Archived previous logo → ${file}`)
  } else {
    fs.writeFileSync(path.join(archiveDir, "old-brand-logo.txt"), String(doc.brandLogo ?? ""))
    console.log("Archived previous brandLogo value → archive/branding/old-brand-logo.txt")
  }

  await settings.updateOne({ _id: doc._id }, { $set: { brandLogo: NEW_LOGO, updatedAt: new Date() } })
  console.log(`brandLogo set to ${NEW_LOGO}`)

  await client.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
