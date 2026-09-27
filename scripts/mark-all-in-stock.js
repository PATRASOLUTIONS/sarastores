/**
 * mark-all-in-stock.js
 *
 * One-shot script to mark every product in the `products` collection as
 * in-stock. Use when the storefront is launching and the seed data has
 * `stock: 0` or `outOfStock: true` flags that suppress the "Add to Cart"
 * button. The product page already shows "Currently unavailable" for any
 * product with `stock <= 0`, so flipping this flag is enough to light up
 * the entire catalog.
 *
 * Usage:
 *   node scripts/mark-all-in-stock.js                # apply to all products
 *   node scripts/mark-all-in-stock.js --dry-run      # report only
 *   node scripts/mark-all-in-stock.js --stock=25     # set a specific stock count
 *   node scripts/mark-all-in-stock.js --skip-oos      # skip products marked permanently out of stock
 *
 * Reads MONGODB_URI from env (falls back to the project's default cluster
 * so the script works in local dev without a .env file). Targets the
 * `e-commerce-bytewise` database to match `lib/mongodb.ts`.
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
const SKIP_OOS = args.includes("--skip-oos")
const STOCK_FLAG = args.find((a) => a.startsWith("--stock="))
const STOCK_VALUE = STOCK_FLAG ? parseInt(STOCK_FLAG.split("=")[1], 10) : 50
const FILTER_FLAG = args.find((a) => a.startsWith("--filter="))
const NAME_FILTER = FILTER_FLAG ? FILTER_FLAG.split("=").slice(1).join("=") : null

if (!Number.isFinite(STOCK_VALUE) || STOCK_VALUE < 0) {
  console.error("Invalid --stock value. Must be a non-negative integer.")
  process.exit(1)
}

// ---- main ----------------------------------------------------------------
async function main() {
  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })

  try {
    await client.connect()
    const db = client.db(DB_NAME)
    const products = db.collection(COLLECTION)

    // Build the selector so operators can scope the run.
    const selector = {}
    if (SKIP_OOS) {
      selector.permanentlyOutOfStock = { $ne: true }
    }
    if (NAME_FILTER) {
      // case-insensitive name filter
      selector.name = { $regex: NAME_FILTER, $options: "i" }
    }

    const total = await products.countDocuments(selector)
    const sample = await products
      .find(selector)
      .project({ name: 1, stock: 1, inStock: 1, outOfStock: 1 })
      .limit(5)
      .toArray()

    console.log(`\n[mark-all-in-stock] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"}`)
    console.log(`  database          : ${DB_NAME}`)
    console.log(`  collection        : ${COLLECTION}`)
    console.log(`  selector          : ${JSON.stringify(selector)}`)
    console.log(`  matched products  : ${total}`)
    console.log(`  stock value to set: ${STOCK_VALUE}`)
    if (sample.length > 0) {
      console.log(`  sample (first 5):`)
      for (const p of sample) {
        console.log(
          `    - ${(p.name || "").slice(0, 60).padEnd(60)} stock=${p.stock} inStock=${p.inStock} outOfStock=${p.outOfStock}`,
        )
      }
    }
    if (total === 0) {
      console.log("\nNothing to update.")
      return
    }

    if (DRY_RUN) {
      console.log("\nDRY-RUN: no changes written. Re-run without --dry-run to apply.")
      return
    }

    const update = {
      $set: {
        stock: STOCK_VALUE,
        inStock: true,
        outOfStock: false,
        updatedAt: new Date(),
      },
      $unset: {
        unavailable: "",
        out_of_stock: "",
        notInStock: "",
      },
    }

    const result = await products.updateMany(selector, update)
    console.log(
      `\nUpdated ${result.modifiedCount} product(s) to in-stock (matched ${result.matchedCount}).`,
    )
  } catch (err) {
    console.error("[mark-all-in-stock] error:", err)
    process.exitCode = 1
  } finally {
    await client.close()
  }
}

main()
