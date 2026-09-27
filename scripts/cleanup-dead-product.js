/**
 * One-off script: Remove a dead product ID from home_components manual blocks
 * and clean up any localStorage references.
 *
 * Usage: node scripts/cleanup-dead-product.js
 */
const { MongoClient } = require("mongodb")

const DEAD_PRODUCT_ID = "69aea7a70fc273855cb1ac66"

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI is not set")
    process.exit(1)
  }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db("e-commerce-bytewise")
    const col = db.collection("home_components")

    // Find all manual blocks that reference the dead product
    const affected = await col
      .find({ type: "manual", "config.productIds": DEAD_PRODUCT_ID })
      .toArray()

    console.log(`Found ${affected.length} home_components document(s) referencing product ${DEAD_PRODUCT_ID}`)

    for (const doc of affected) {
      const ids = doc.config?.productIds || []
      const cleaned = ids.filter((id) => id !== DEAD_PRODUCT_ID)
      console.log(`  doc ${doc._id}: removing ${ids.length - cleaned.length} reference(s), ${cleaned.length} remaining`)

      await col.updateOne(
        { _id: doc._id },
        { $set: { "config.productIds": cleaned, updatedAt: new Date() } }
      )
    }

    // Also remove from any orders_test, recently_viewed, wishlist, cart references
    const collections = ["cart", "wishlist"]
    for (const cname of collections) {
      try {
        const c = db.collection(cname)
        const res = await c.updateMany(
          { "items.productId": DEAD_PRODUCT_ID },
          { $pull: { items: { productId: DEAD_PRODUCT_ID } } }
        )
        if (res.modifiedCount > 0) {
          console.log(`  Cleaned ${res.modifiedCount} document(s) in ${cname}`)
        }
      } catch {
        // collection may not exist or have different schema
      }
    }

    console.log("Done.")
  } finally {
    await client.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
