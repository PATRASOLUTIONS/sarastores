import { MongoClient } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const options = {
  maxPoolSize: 10,
  // The driver's own default is 30s. A 5s budget here tripped whenever the
  // event loop was busy — dev compilation, a serverless cold start — and
  // surfaced as "Server selection timed out" even though the network and the
  // cluster were healthy.
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
}

// Cached on globalThis so dev HMR reuses one pool instead of leaking a client
// per reload; in production each instance gets its own.
const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
}

/**
 * Caching the connect() promise is what keeps one pool per instance, but a
 * *rejected* promise used to stay cached forever: a single failure meant every
 * later call re-awaited it and failed instantly with the original error until
 * the process restarted. Dropping the cache on rejection lets the next caller
 * reconnect.
 */
export function getMongoClient(): Promise<MongoClient> {
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(uri, options)
    globalWithMongo._mongoClientPromise = client.connect().catch((error) => {
      globalWithMongo._mongoClientPromise = undefined
      throw error
    })
  }
  return globalWithMongo._mongoClientPromise
}

export async function connectToDatabase() {
  try {
    const client = await getMongoClient()
    const db = client.db("e-commerce-bytewise")
    return { client, db }
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error)
    throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
