#!/usr/bin/env node
/**
 * Migration script: move legacy `manufacturer` -> `manufacturerName` and remove `manufacturer` field
 * Usage: node scripts/migrate-manufacturer.js
 * It will prompt for confirmation and then update documents in the `products` collection.
 */
const { MongoClient } = require('mongodb')
const readline = require('readline')
const uri = process.env.MONGODB_URI || process.env.NEXT_PUBLIC_MONGODB_URI
if (!uri) {
  console.error('MONGODB_URI is not set. Refusing to run.')
  process.exit(1)
}
const dbName = process.env.MONGODB_DB || 'bytewise' // adjust if needed

async function confirm(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(prompt, (ans) => { rl.close(); resolve(ans) }))
}

async function run() {
  console.log('Migration: promote `manufacturer` -> `manufacturerName` and remove `manufacturer`')
  console.log('Connecting to', uri, 'db:', dbName)
  const ans = (await confirm('Proceed with migration? Type YES to continue: ')) || ''
  if (ans.trim() !== 'YES') {
    console.log('Aborted')
    process.exit(0)
  }

  const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  try {
    await client.connect()
    const db = client.db(dbName)
    const col = db.collection('products')

    // Find documents that have `manufacturer` or no `manufacturerName`
    const cursor = col.find({ $or: [ { manufacturer: { $exists: true, $ne: null } }, { manufacturerName: { $exists: false } } ] })
    let updated = 0
    while (await cursor.hasNext()) {
      const doc = await cursor.next()
      const update: any = {}
      // If manufacturerName missing and manufacturer present, copy it
      if ((!doc.manufacturerName || doc.manufacturerName === '') && doc.manufacturer) {
        update.manufacturerName = doc.manufacturer
      }
      // Remove the legacy field if present
      if (doc.manufacturer !== undefined) update.manufacturer = undefined

      if (Object.keys(update).length === 0) continue

      // Build $set and $unset
      const set: any = {}
      const unset: any = {}
      if (update.manufacturerName !== undefined) set.manufacturerName = update.manufacturerName
      if (update.manufacturer === undefined && doc.manufacturer !== undefined) unset.manufacturer = ''

      const ops: any = {}
      if (Object.keys(set).length) ops.$set = set
      if (Object.keys(unset).length) ops.$unset = unset

      const res = await col.updateOne({ _id: doc._id }, ops)
      if (res.modifiedCount > 0) updated++
    }

    console.log('Migration complete. Documents updated:', updated)
  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await client.close()
  }
}

run()
