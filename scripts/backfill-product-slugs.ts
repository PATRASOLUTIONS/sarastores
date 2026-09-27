/**
 * Backfill slugs for existing products that don't have one.
 * Run: npx tsx scripts/backfill-product-slugs.ts
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

function generateProductSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI not set')
    process.exit(1)
  }

  console.log('Connecting to MongoDB...')
  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db('e-commerce-bytewise')
    const collection = db.collection('products')

    // Count total products
    const total = await collection.countDocuments()
    console.log(`Total products in database: ${total}`)

    // Find products without slug
    const products = await collection.find({ slug: { $exists: false } }).toArray()
    console.log(`Products without slug: ${products.length}`)

    if (products.length === 0) {
      console.log('All products already have slugs. Nothing to do.')
      return
    }

    let updated = 0
    let skipped = 0
    const slugCount: Record<string, number> = {}

    for (const product of products) {
      const baseSlug = generateProductSlug(product.name || '')
      if (!baseSlug) {
        skipped++
        continue
      }

      // Handle duplicate slugs by appending counter
      if (slugCount[baseSlug] !== undefined) {
        slugCount[baseSlug]++
        const finalSlug = `${baseSlug}-${slugCount[baseSlug]}`
        await collection.updateOne(
          { _id: product._id },
          { $set: { slug: finalSlug } }
        )
      } else {
        slugCount[baseSlug] = 0
        // Check if slug already exists in DB (from earlier runs or other products)
        const existing = await collection.findOne({ slug: baseSlug, _id: { $ne: product._id } })
        const finalSlug = existing ? `${baseSlug}-1` : baseSlug
        if (existing) slugCount[baseSlug] = 1
        await collection.updateOne(
          { _id: product._id },
          { $set: { slug: finalSlug } }
        )
      }
      updated++
    }

    console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}`)

    // Create unique index on slug (sparse so products without slug don't conflict)
    await collection.createIndex({ slug: 1 }, { unique: true, sparse: true })
    console.log('Created unique index on slug')

    // Verify
    const withSlug = await collection.countDocuments({ slug: { $exists: true } })
    const withoutSlug = await collection.countDocuments({ slug: { $exists: false } })
    console.log(`\nVerification: ${withSlug} products with slug, ${withoutSlug} without slug`)
  } finally {
    await client.close()
  }
}

main().catch(console.error)
