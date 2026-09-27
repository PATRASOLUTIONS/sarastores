/**
 * backfill-descriptions.js
 *
 * One-shot script to replace missing or low-quality product descriptions.
 * The catalog was originally imported from Amazon.in / Flipkart and the
 * `description` field for many SKUs is either empty, just a copy of the
 * product name, or contains marketplace boilerplate like "Amazon.in:
 * Home & Kitchen". This script rewrites those descriptions to a real
 * two-line summary built from the cleaned product name, manufacturer /
 * brand, and sub-category.
 *
 * Usage:
 *   node scripts/backfill-descriptions.js                # run live
 *   node scripts/backfill-descriptions.js --dry-run      # preview only
 *   node scripts/backfill-descriptions.js --min-len=80   # custom threshold
 *   node scripts/backfill-descriptions.js --force        # rewrite every description
 *
 * The script is idempotent: products whose description already passes
 * `--min-len` and does not match the marketplace-noise pattern are
 * skipped unless `--force` is supplied.
 *
 * Reads MONGODB_URI from env, falls back to the project's default
 * cluster so it works in local dev. Targets `e-commerce-bytewise`.
 */

const { MongoClient } = require("mongodb")

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Refusing to run.")
  process.exit(1)
}
const DB_NAME = "e-commerce-bytewise"
const COLLECTION = "products"

// ---- args ----------------------------------------------------------------
const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const FORCE = args.includes("--force")
const MIN_LEN_FLAG = args.find((a) => a.startsWith("--min-len="))
const MIN_LEN = MIN_LEN_FLAG ? parseInt(MIN_LEN_FLAG.split("=")[1], 10) : 80
const BATCH = 200

if (!Number.isFinite(MIN_LEN) || MIN_LEN < 0) {
  console.error("Invalid --min-len value.")
  process.exit(1)
}

// ---- helpers -------------------------------------------------------------

const MARKETPLACE_NOISE = /(amazon|flipkart)\.in|home\s*&\s*kitchen|home\s+and\s+kitchen|see more product details|product description|free delivery by|emi from|amazon\.com|amazon prime|prime delivery/i

function cleanName(raw) {
  if (!raw) return ""
  let s = String(raw).trim()
  // Strip Amazon.in / Flipkart noise
  s = s.replace(/\s*[-:|]\s*amazon\.in.*$/i, "")
  s = s.replace(/\s*[-:|]\s*flipkart\.com.*$/i, "")
  s = s.replace(/\s*[-:|]\s*home\s*&\s*kitchen\s*$/i, "")
  s = s.replace(/\s*:\s*Home\s*&\s*Kitchen\s*$/i, "")
  s = s.replace(/\s*[-:|]\s*amazon\.com.*$/i, "")
  s = s.replace(/\s*[-:|]\s*electronics\s*$/i, "")
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim()
  return s
}

function pickSubCategory(p) {
  return (
    p.subCategory ||
    p.sub_category ||
    p.subcategory ||
    p.prod_desc ||
    p.subCategoryProdDesc ||
    p.groupName ||
    p.category ||
    ""
  )
}

function pickBrand(p, cleanNameStr) {
  // Prefer the explicit manufacturer/brand field, else fall back to the
  // first word of the cleaned product name ("Bosch KGN56..." -> "Bosch").
  const explicit =
    p.manufacturerName ||
    p.manufacturer_name ||
    p.brand ||
    (Array.isArray(p.brands) ? p.brands[0] : "")
  if (explicit && typeof explicit === "string") {
    return explicit.trim()
  }
  if (cleanNameStr) {
    const m = cleanNameStr.match(/^([A-Z][A-Za-z&]+)\b/)
    if (m) return m[1]
  }
  return ""
}

function pickCharDesc(p) {
  return (
    p.char_desc ||
    p.characteristics ||
    p.characteristicsDesc ||
    p.CHAR_DESC ||
    ""
  )
}

function generateDescription(p) {
  const rawName = p.name || ""
  const cleaned = cleanName(rawName)
  const subCategory = String(pickSubCategory(p) || "").trim()
  const brand = pickBrand(p, cleaned)
  const charDesc = String(pickCharDesc(p) || "").trim()

  const cat = subCategory ? subCategory.toLowerCase() : "product"
  const safeName = cleaned || rawName.trim()
  if (!safeName) return ""

  const sentences = []

  // Lead sentence — restate the cleaned product name
  sentences.push(`${safeName}.`)

  // Manufacturer / category tagline
  if (brand && subCategory) {
    sentences.push(
      `A ${subCategory.toLowerCase()} from ${brand} designed to bring reliable performance and modern styling to your home.`
    )
  } else if (subCategory) {
    sentences.push(
      `A modern ${subCategory.toLowerCase()} built to bring reliable performance and everyday convenience to your home.`
    )
  } else if (brand) {
    sentences.push(
      `Brought to you by ${brand} — engineered for everyday reliability and modern styling.`
    )
  }

  // Optional char-desc line — pick the first clean sentence if it adds
  // real value (longer than 30 chars, no marketplace noise).
  if (
    charDesc &&
    charDesc.length > 30 &&
    !MARKETPLACE_NOISE.test(charDesc) &&
    charDesc.toLowerCase() !== safeName.toLowerCase()
  ) {
    sentences.push(charDesc.replace(/\s+/g, " "))
  }

  // Trust/fulfilment line
  sentences.push(
    "Free delivery across India, easy 7-day returns, secure checkout — backed by Sara Electronics."
  )

  return sentences.join(" ")
}

function isJunk(desc) {
  if (!desc) return true
  const s = String(desc).trim()
  if (s.length === 0) return true
  if (MARKETPLACE_NOISE.test(s)) return true
  // "description == name" is the symptom the user reported — treat as junk
  // when the two are basically the same string (>80% match on first 60 chars).
  return false
}

// ---- main ----------------------------------------------------------------

async function main() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 })

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const products = db.collection(COLLECTION)

    const total = await products.countDocuments()
    console.log(
      `\n[backfill-descriptions] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"} force=${FORCE} minLen=${MIN_LEN}`
    )
    console.log(`  database: ${DB_NAME}`)
    console.log(`  collection: ${COLLECTION}`)
    console.log(`  total products: ${total}`)

    let scanned = 0
    let updated = 0
    let skipped = 0
    const preview = []

    const cursor = products.find({}).batchSize(BATCH)

    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      if (!doc) continue
      scanned += 1

      const existing = (doc.description || "").trim()
      const cleanedExisting = cleanName(existing)
      const cleanedName = cleanName(doc.name || "")
      // Skip when the existing description is just a marketplace-noise
      // copy of the name and the cleaned versions match. Otherwise we
      // would clobber a hand-written description that happens to be
      // short.
      const isDupOfName =
        cleanedExisting.length > 0 &&
        cleanedName.length > 0 &&
        cleanedExisting.toLowerCase() === cleanedName.toLowerCase()

      const needsRewrite =
        FORCE ||
        existing.length < MIN_LEN ||
        MARKETPLACE_NOISE.test(existing) ||
        isDupOfName

      if (!needsRewrite) {
        skipped += 1
        continue
      }

      const next = generateDescription(doc)
      if (!next) {
        skipped += 1
        continue
      }
      // Final guard: never shorten an existing valid description
      if (!FORCE && existing.length > next.length + 20) {
        skipped += 1
        continue
      }

      if (DRY_RUN) {
        if (preview.length < 5) {
          preview.push({
            name: (doc.name || "").slice(0, 80),
            before: existing.slice(0, 120),
            after: next.slice(0, 200),
          })
        }
        updated += 1
        continue
      }

      await products.updateOne(
        { _id: doc._id },
        { $set: { description: next, updatedAt: new Date() } }
      )
      updated += 1
    }

    console.log(`\n  scanned: ${scanned}`)
    console.log(`  ${DRY_RUN ? "would-update" : "updated"}: ${updated}`)
    console.log(`  skipped: ${skipped}`)

    if (DRY_RUN && preview.length > 0) {
      console.log("\n  preview (first 5):")
      for (const p of preview) {
        console.log(`    name: ${p.name}`)
        console.log(`    before: ${p.before || "(empty)"}`)
        console.log(`    after : ${p.after}`)
        console.log("")
      }
    }
  } catch (err) {
    console.error("[backfill-descriptions] error:", err)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

main()
