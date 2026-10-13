/**
 * Preview missing order IDs: npx tsx scripts/backfill-order-ids.ts
 * Apply acknowledged batches: npx tsx scripts/backfill-order-ids.ts --apply
 * Existing IDs are preserved. Each batch and its counter reservation commit together.
 */
import { MongoClient, type Db, type ObjectId } from 'mongodb'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface OrderDocument {
  _id: ObjectId | string
  orderId?: string
  createdAt?: Date
}

interface CounterDocument {
  _id: string
  seq: number
}

const PREFIX = 'SARAECOM-'
const START_NUMBER = 100001
const BATCH_SIZE = 500

export async function backfillOrderIds(client: MongoClient, db: Db, apply = false) {
  const collections = {
    orders: db.collection<OrderDocument>('orders'),
    partner_orders: db.collection<OrderDocument>('partner_orders'),
  }
  const counters = db.collection<CounterDocument>('counters')
  let maximum = START_NUMBER - 1
  for (const collection of Object.values(collections)) {
    const existing = await collection.find({ orderId: { $regex: '^SARAECOM-' } }, { projection: { orderId: 1 } }).toArray()
    for (const order of existing) {
      const suffix = order.orderId?.slice(PREFIX.length)
      const sequence = Number(suffix)
      if (!suffix || !/^\d+$/.test(suffix) || !Number.isSafeInteger(sequence) || sequence < 1) {
        throw new Error('Existing SARAECOM order ID is invalid; repair before applying the backfill')
      }
      maximum = Math.max(maximum, sequence)
    }
  }
  const currentCounter = await counters.findOne({ _id: 'order_number' })
  if (currentCounter && (!Number.isSafeInteger(currentCounter.seq) || currentCounter.seq < 0)) {
    throw new Error('Order counter is invalid; repair before applying the backfill')
  }
  maximum = Math.max(maximum, currentCounter?.seq ?? 0)
  const pending = []
  for (const name of ['orders', 'partner_orders'] as const) {
    const orders = await collections[name].find({ orderId: { $exists: false } }, { projection: { createdAt: 1 } }).toArray()
    pending.push(...orders.map(order => ({ ...order, collection: name })))
  }
  pending.sort((a, b) => (a.createdAt instanceof Date ? a.createdAt.getTime() : 0)
    - (b.createdAt instanceof Date ? b.createdAt.getTime() : 0)
    || a._id.toString().localeCompare(b._id.toString()))
  if (!Number.isSafeInteger(maximum + pending.length)) throw new Error('Order counter would exceed the safe sequence range')
  if (!apply) return { dryRun: true, candidates: pending.length, updated: 0, minimumNextSequence: maximum + 1 }

  let updated = 0
  const session = client.startSession()
  try {
    for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
      const batch = pending.slice(offset, offset + BATCH_SIZE)
      await session.withTransaction(async () => {
        const counter = await counters.findOneAndUpdate(
          { _id: 'order_number' },
          [{ $set: { seq: { $add: [{ $max: [{ $ifNull: ['$seq', START_NUMBER - 1] }, maximum] }, batch.length] } } }],
          { upsert: true, returnDocument: 'after', session },
        )
        if (!counter || !Number.isSafeInteger(counter.seq) || counter.seq < maximum + batch.length) {
          throw new Error('Order counter reservation was invalid')
        }
        let sequence = counter.seq - batch.length
        for (const order of batch) {
          const result = await collections[order.collection].updateOne(
            { _id: order._id, orderId: { $exists: false } },
            { $set: { orderId: `${PREFIX}${String(++sequence).padStart(8, '0')}` } },
            { session },
          )
          if (!result.acknowledged || result.matchedCount !== 1 || result.modifiedCount !== 1) {
            throw new Error('Order changed during backfill; this batch was rolled back. Prior committed batches remain applied.')
          }
        }
      })
      updated += batch.length
    }
  } finally {
    await session.endSession()
  }
  return { dryRun: false, candidates: pending.length, updated }
}

async function main() {
  if (process.argv.slice(2).some(argument => argument !== '--apply')) throw new Error('Only --apply is supported; omit it for a read-only preview')
  try {
    const content = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
    for (const line of content.split('\n')) {
      const match = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    }
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is required')
  const client = new MongoClient(uri)
  try {
    await client.connect()
    console.log(await backfillOrderIds(client, client.db('e-commerce-bytewise'), process.argv.includes('--apply')))
  } finally {
    await client.close()
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Order ID backfill failed:', error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
