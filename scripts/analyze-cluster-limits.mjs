#!/usr/bin/env node
/**
 * Reports cluster capacity signals that bound how many concurrent serverless
 * instances the app can support. Read-only.
 *
 * Usage: node scripts/analyze-cluster-limits.mjs
 */
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

const client = new MongoClient(uri)
await client.connect()
const admin = client.db().admin()

try {
  const status = await admin.serverStatus()
  const conn = status.connections || {}
  console.log(`\n  CLUSTER CONNECTIONS`)
  console.log(`    current    : ${conn.current ?? "?"}`)
  console.log(`    available  : ${conn.available ?? "?"}`)
  console.log(`    totalCreated: ${conn.totalCreated ?? "?"}`)
  const ceiling = (conn.current ?? 0) + (conn.available ?? 0)
  console.log(`    ceiling    : ${ceiling}`)

  const poolProd = Number(process.env.MONGODB_MAX_POOL_SIZE) || 3
  console.log(`\n  SERVERLESS HEADROOM`)
  console.log(`    maxPoolSize per instance (prod) : ${poolProd}`)
  if (ceiling > 0) {
    console.log(`    max concurrent instances        : ~${Math.floor((ceiling - (conn.current ?? 0)) / poolProd)}`)
    console.log(`    (each warm instance holds up to ${poolProd} sockets)`)
  }

  console.log(`\n  VERSION`)
  console.log(`    ${status.version ?? "?"}  host=${String(status.host ?? "?").split(".")[0]}`)
} catch (e) {
  console.log(`\n  serverStatus unavailable (shared tiers restrict it): ${e.message.slice(0, 70)}`)
}

// hostInfo also tends to be blocked on shared tiers, but memory size is the
// clearest tier signal when it is available.
try {
  const host = await admin.command({ hostInfo: 1 })
  console.log(`    memSizeMB=${host.system?.memSizeMB}  cores=${host.system?.numCores}`)
} catch {
  console.log(`    hostInfo blocked — likely an M0/M2/M5 shared tier`)
}

await client.close()
console.log("")
