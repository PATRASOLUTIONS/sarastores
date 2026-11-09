import fs from "node:fs/promises"
import { MongoClient } from "mongodb"
const local = JSON.parse(await fs.readFile(".seo-local/merchant-scraper/cache.json", "utf8"))
const client = new MongoClient(process.env.MONGODB_URI, { family: 4, maxPoolSize: 2, serverSelectionTimeoutMS: 12000, socketTimeoutMS: 45000 })
try {
  await client.connect()
  const collection = client.db(process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise").collection("merchant_product_enrichments")
  const complete = await collection.countDocuments({ status: "complete" }, { maxTimeMS: 10000 })
  const fetching = await collection.countDocuments({ status: "fetching" }, { maxTimeMS: 10000 })
  console.log(JSON.stringify({ complete, fetching, localCacheItems: Object.keys(local).length }))
} finally { await client.close() }
