/**
 * Backfill SARAECOM order IDs for all existing orders.
 * Assigns sequential IDs starting from SARAECOM-001001 across both
 * `orders` and `partner_orders` collections, sorted by createdAt.
 *
 * Run: npx tsx scripts/backfill-order-ids.ts
 */
import { MongoClient } from 'mongodb'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env manually
try {
  const envFile = readFileSync(resolve(__dirname, '../.env'), 'utf-8')
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {}

const START_NUMBER = 1001
const PREFIX = "SARAECOM-"
const BATCH_SIZE = 500

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error("MONGODB_URI not set in .env")
    process.exit(1)
  }

  const client = new MongoClient(uri)

  try {
    await client.connect()
    const db = client.db("e-commerce-bytewise")

    const ordersCol = db.collection("orders")
    const partnerCol = db.collection("partner_orders")
    const countersCol = db.collection("counters")

    // Count documents without orderId in both collections
    const ordersWithout = await ordersCol.countDocuments({ orderId: { $exists: false } })
    const ordersWith = await ordersCol.countDocuments({ orderId: { $exists: true } })
    const partnerWithout = await partnerCol.countDocuments({ orderId: { $exists: false } })
    const partnerWith = await partnerCol.countDocuments({ orderId: { $exists: true } })

    console.log(`Orders collection:     ${ordersWithout} without orderId, ${ordersWith} already have one`)
    console.log(`Partner orders:        ${partnerWithout} without orderId, ${partnerWith} already have one`)

    const totalToBackfill = ordersWithout + partnerWithout
    if (totalToBackfill === 0) {
      console.log("Nothing to backfill — all orders already have orderId.")
      await client.close()
      return
    }

    console.log(`\nTotal to backfill: ${totalToBackfill}`)
    console.log(`IDs will be: ${PREFIX}${String(START_NUMBER).padStart(6, "0")} through ${PREFIX}${String(START_NUMBER + totalToBackfill - 1).padStart(6, "0")}\n`)

    // Fetch all orders from both collections, sorted by createdAt
    console.log("Fetching orders...")
    const allOrders = await ordersCol
      .find({ orderId: { $exists: false } })
      .sort({ createdAt: 1 })
      .project({ _id: 1, createdAt: 1 })
      .toArray()

    const allPartnerOrders = await partnerCol
      .find({ orderId: { $exists: false } })
      .sort({ createdAt: 1 })
      .project({ _id: 1, createdAt: 1 })
      .toArray()

    // Merge and sort by createdAt to get a single chronological list
    const merged = [
      ...allOrders.map((o: any) => ({ coll: "orders", _id: o._id, createdAt: o.createdAt })),
      ...allPartnerOrders.map((o: any) => ({ coll: "partner_orders", _id: o._id, createdAt: o.createdAt })),
    ].sort((a, b) => {
      const ta = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
      const tb = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
      return ta - tb
    })

    console.log(`Merged ${merged.length} documents across both collections\n`)

    // Assign IDs in batches
    let counter = START_NUMBER
    let updated = 0

    for (let i = 0; i < merged.length; i += BATCH_SIZE) {
      const batch = merged.slice(i, i + BATCH_SIZE)

      // Group by collection
      const orderUpdates = batch
        .filter(d => d.coll === "orders")
        .map(d => ({
          updateOne: {
            filter: { _id: d._id },
            update: { $set: { orderId: `${PREFIX}${String(counter++).padStart(6, "0")}` } },
          }
        }))

      const partnerUpdates = batch
        .filter(d => d.coll === "partner_orders")
        .map(d => ({
          updateOne: {
            filter: { _id: d._id },
            update: { $set: { orderId: `${PREFIX}${String(counter++).padStart(6, "0")}` } },
          }
        }))

      const ops: any[] = []
      if (orderUpdates.length > 0) ops.push(ordersCol.bulkWrite(orderUpdates, { ordered: false }))
      if (partnerUpdates.length > 0) ops.push(partnerCol.bulkWrite(partnerUpdates, { ordered: false }))

      await Promise.all(ops)
      updated += batch.length

      process.stdout.write(`\r  Updated ${updated}/${merged.length} orders...`)
    }

    console.log("\n")

    // Initialize the counter so new orders continue from the right number
    const nextNumber = counter
    await countersCol.updateOne(
      { _id: "order_number" } as any,
      { $set: { seq: nextNumber - 1 } },
      { upsert: true }
    )
    console.log(`Counter initialized to ${nextNumber - 1} (next order will be ${PREFIX}${String(nextNumber).padStart(6, "0")})`)

    // Verify
    const verifyOrders = await ordersCol.countDocuments({ orderId: { $exists: true } })
    const verifyPartner = await partnerCol.countDocuments({ orderId: { $exists: true } })
    console.log(`\nVerification:`)
    console.log(`  orders:         ${verifyOrders} with orderId`)
    console.log(`  partner_orders: ${verifyPartner} with orderId`)

    console.log(`\nDone! ${updated} orders backfilled.`)

  } finally {
    await client.close()
  }
}

main().catch(console.error)
