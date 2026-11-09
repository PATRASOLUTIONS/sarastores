// Read-only schema/index inventory. Never prints customer data or configuration values.
import { MongoClient } from 'mongodb'
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
try {
  await client.connect()
  const db = client.db(process.env.MONGODB_DB || process.env.DB_NAME || 'e-commerce-bytewise')
  for (const name of ['analytics_events', 'users', 'carts', 'checkout_intents', 'payments', 'orders']) {
    const collection = db.collection(name)
    const indexes = await collection.listIndexes().toArray().catch(() => [])
    const fields = await collection.aggregate([
      { $limit: 20 }, { $project: { fields: { $objectToArray: '$$ROOT' } } },
      { $unwind: '$fields' }, { $group: { _id: '$fields.k', types: { $addToSet: { $type: '$fields.v' } } } },
      { $sort: { _id: 1 } },
    ], { maxTimeMS: 5000 }).toArray()
    console.log(JSON.stringify({ collection: name, indexes: indexes.map(i => ({ name: i.name, key: i.key })), fields }))
  }
} catch { console.error('Customer-flow inspection failed; check database connectivity. No customer data was printed.'); process.exitCode = 1 }
finally { await client.close() }
