#!/usr/bin/env node
/**
 * Measures sustained read throughput against the Atlas cluster.
 *
 * Shared tiers (M0/M2/M5) enforce a hard operations-per-second ceiling
 * independent of application code, so this is the number that actually bounds
 * concurrent-user capacity.
 *
 * Read-only: issues findOne by _id against `products`. Short burst by design.
 *
 * Usage: node scripts/measure-db-throughput.mjs [seconds]
 */
import { MongoClient } from "mongodb"

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error("MONGODB_URI is not set")
  process.exit(1)
}

const SECONDS = Number(process.argv[2] || 6)
const CONCURRENCY = 20

const client = new MongoClient(uri, { maxPoolSize: CONCURRENCY })
await client.connect()
const col = client.db(process.env.MONGODB_DB || "e-commerce-bytewise").collection("products")

const sample = await col.find({}, { projection: { _id: 1 } }).limit(50).toArray()
const ids = sample.map((d) => d._id)

console.log(`\n  Measuring read throughput for ${SECONDS}s at concurrency ${CONCURRENCY}...\n`)

let ops = 0
let errors = 0
const latencies = []
const stopAt = Date.now() + SECONDS * 1000

async function worker() {
  while (Date.now() < stopAt) {
    const id = ids[Math.floor(Math.random() * ids.length)]
    const t0 = performance.now()
    try {
      await col.findOne({ _id: id }, { projection: { name: 1 } })
      latencies.push(performance.now() - t0)
      ops++
    } catch {
      errors++
    }
  }
}

const started = Date.now()
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
const elapsed = (Date.now() - started) / 1000

latencies.sort((a, b) => a - b)
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] ?? 0

console.log(`  operations        : ${ops}`)
console.log(`  errors            : ${errors}`)
console.log(`  throughput        : ${(ops / elapsed).toFixed(0)} ops/sec`)
console.log(`  latency p50       : ${p(0.5).toFixed(1)} ms`)
console.log(`  latency p95       : ${p(0.95).toFixed(1)} ms`)
console.log(`  latency p99       : ${p(0.99).toFixed(1)} ms`)

const rate = ops / elapsed
console.log(`\n  INTERPRETATION`)
if (rate < 150) {
  console.log(`    ~${rate.toFixed(0)} ops/s is consistent with an M0/M2 shared tier,`)
  console.log(`    which caps sustained throughput around 100 ops/s.`)
} else if (rate < 600) {
  console.log(`    ~${rate.toFixed(0)} ops/s suggests M5 or a throttled shared tier.`)
} else {
  console.log(`    ~${rate.toFixed(0)} ops/s suggests a dedicated tier (M10+).`)
}

// Every signed-in page view costs one users.findOne in /api/auth/session.
console.log(`\n  What that means for concurrent signed-in users:`)
for (const pageEvery of [5, 10, 30]) {
  const users = Math.floor(rate * pageEvery)
  console.log(`    at 1 page view every ${String(pageEvery).padStart(2)}s -> ~${String(users).padStart(6)} concurrent signed-in users before the DB saturates`)
}

await client.close()
console.log("")
