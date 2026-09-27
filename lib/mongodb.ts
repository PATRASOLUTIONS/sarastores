import { MongoClient } from "mongodb"

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"')
}

const uri = process.env.MONGODB_URI
const isProd = process.env.NODE_ENV === "production"

const options = {
  // Every serverless instance opens its own pool, so the cluster sees
  // maxPoolSize x instanceCount connections. A pool of 10 exhausts an Atlas
  // connection limit after ~150 instances, which is well inside a traffic
  // spike. Keep it small in production and let horizontal scale do the work;
  // dev is a single long-lived process, so a bigger pool is free there.
  maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE) || (isProd ? 3 : 10),
  minPoolSize: 0,
  // Drop idle sockets so an instance that goes quiet stops holding connections
  // other instances need.
  maxIdleTimeMS: 30000,
  // A 5s budget used to trip whenever the event loop was busy — dev
  // compilation, a cold start — and surfaced as "Server selection timed out"
  // on a healthy cluster, so dev keeps the driver's 30s default. In
  // production the opposite failure matters more: once the connection limit
  // is hit, a 30s wait turns backpressure into function timeouts and retries
  // instead of a fast 5xx the client can back off from.
  serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || (isProd ? 5000 : 30000),
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
    // Same resolution order the scripts in scripts/ already use, so a load test
    // or a migration can point the app at another database without a code edit.
    const db = client.db(process.env.MONGODB_DB || process.env.DB_NAME || "e-commerce-bytewise")
    return { client, db }
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error)
    throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}
