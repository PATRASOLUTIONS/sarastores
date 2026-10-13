/**
 * Shared rate-limit counter with a durable backend.
 *
 * The in-memory counters elsewhere in this codebase live in module scope, so on
 * serverless they reset on every cold start and are not shared between warm
 * instances. Under real traffic the effective limit becomes `limit x instances`,
 * which is exactly the condition a credential-stuffing burst needs.
 *
 * Uses Upstash's REST API when configured — HTTP rather than a TCP client, so
 * there is no connection pool to exhaust from serverless, and no new dependency.
 * Production defaults to shared MongoDB counters when Upstash is not configured.
 * Memory is reserved for development/tests. Store failures fail closed.
 */

import { createHash } from "node:crypto"
import type { Collection } from "mongodb"
import { RateLimitUnavailableError } from "@/lib/api-error"

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export type RateLimitBackend = "upstash" | "mongodb" | "memory"

export function rateLimitBackend(): RateLimitBackend {
  const configured = process.env.RATE_LIMIT_BACKEND
  if (configured && !["upstash", "mongodb", "memory"].includes(configured)) {
    console.error("[rate-limit] Invalid backend configuration")
    throw new RateLimitUnavailableError()
  }
  if (configured === "memory" && process.env.NODE_ENV === "production") {
    console.error("[rate-limit] Production cannot use per-instance memory counters")
    throw new RateLimitUnavailableError()
  }
  if (configured === "upstash" && (!UPSTASH_URL || !UPSTASH_TOKEN)) {
    console.error("[rate-limit] Upstash credentials are missing")
    throw new RateLimitUnavailableError()
  }
  if (configured === "upstash" || configured === "mongodb" || configured === "memory") return configured
  if (UPSTASH_URL && UPSTASH_TOKEN) return "upstash"
  return process.env.NODE_ENV === "production" ? "mongodb" : "memory"
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  /** Seconds until the window resets. */
  resetSeconds: number
}

const memory = new Map<string, { count: number; resetAt: number }>()

interface MongoCounter {
  _id: string
  count: number
  resetAt: Date
}

let mongoCollectionPromise: Promise<Collection<MongoCounter>> | undefined
const mongoKey = (key: string) => createHash("sha256").update(key).digest("hex")

async function mongoCollection(): Promise<Collection<MongoCounter>> {
  if (!mongoCollectionPromise) {
    mongoCollectionPromise = import("@/lib/db-service")
      .then(async ({ getCollection }) => {
        const collection = await getCollection<MongoCounter>("rate_limits")
        await collection.createIndex({ resetAt: 1 }, { name: "rate_limit_expiry", expireAfterSeconds: 0 })
        return collection
      })
      .catch((error: unknown) => {
        mongoCollectionPromise = undefined
        console.error("[rate-limit] MongoDB counter initialization failed", error instanceof Error ? error.name : "UnknownError")
        throw new RateLimitUnavailableError()
      })
  }
  return mongoCollectionPromise
}

async function mongoHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  try {
    const collection = await mongoCollection()
    const expired = { $lte: [{ $ifNull: ["$resetAt", new Date(0)] }, "$$NOW"] }
    const update = [{
      $set: {
        count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
        resetAt: { $cond: [expired, { $add: ["$$NOW", windowMs] }, "$resetAt"] },
      },
    }]
    let counter
    try {
      counter = await collection.findOneAndUpdate({ _id: mongoKey(key) }, update, { upsert: true, returnDocument: "after" })
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== 11000) throw error
      // Concurrent first requests may race on the unique _id during upsert.
      counter = await collection.findOneAndUpdate({ _id: mongoKey(key) }, update, { returnDocument: "after" })
    }
    if (!counter || !Number.isFinite(counter.count) || !Number.isFinite(Number(counter.resetAt))) {
      throw new RateLimitUnavailableError()
    }
    return {
      limited: counter.count > limit,
      remaining: Math.max(0, limit - counter.count),
      resetSeconds: Math.max(0, Math.ceil((Number(counter.resetAt) - Date.now()) / 1000)),
    }
  } catch (error) {
    console.error("[rate-limit] MongoDB counter failed", error instanceof Error ? error.name : "UnknownError")
    throw new RateLimitUnavailableError()
  }
}

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memory.get(key)

  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: limit - 1, resetSeconds: Math.ceil(windowMs / 1000) }
  }

  entry.count++
  const resetSeconds = Math.ceil((entry.resetAt - now) / 1000)
  return { limited: entry.count > limit, remaining: Math.max(0, limit - entry.count), resetSeconds }
}

async function upstashPipeline(commands: (string | number)[][]): Promise<Array<{ result: unknown }>> {
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${UPSTASH_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      console.warn("[rate-limit] upstash returned", res.status)
      throw new RateLimitUnavailableError()
    }
    const data: unknown = await res.json()
    if (!Array.isArray(data) || data.length !== commands.length ||
        data.some((item: unknown) => !item || typeof item !== "object" || !("result" in item) || "error" in item)) {
      throw new RateLimitUnavailableError()
    }
    return data.map((item: { result: unknown }) => ({ result: item.result }))
  } catch (error) {
    console.warn("[rate-limit] upstash unavailable", error instanceof Error ? error.name : "UnknownError")
    throw new RateLimitUnavailableError()
  }
}

/**
 * Count one request against `key`. Returns whether the caller is over the limit.
 *
 * Fixed window rather than sliding: it needs one round trip instead of a sorted
 * set, and the difference does not matter for abuse prevention at these limits.
 */
export async function rateLimitHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!key || !Number.isSafeInteger(limit) || limit < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new RangeError("Rate-limit key, limit and window must be valid")
  }
  const backend = rateLimitBackend()
  if (backend === "memory") return memoryHit(key, limit, windowMs)
  if (backend === "mongodb") return mongoHit(key, limit, windowMs)

  // PEXPIRE ... NX only sets a TTL when the key has none, so a crash between
  // INCR and PEXPIRE cannot leave a counter that never expires.
  const result = await upstashPipeline([
    ["INCR", key],
    ["PEXPIRE", key, windowMs, "NX"],
    ["PTTL", key],
  ])

  if (typeof result[0]?.result !== "number" || typeof result[2]?.result !== "number" ||
      !Number.isFinite(result[0].result) || !Number.isFinite(result[2].result) || result[2].result < 0) {
    console.error("[rate-limit] Invalid Upstash counter result")
    throw new RateLimitUnavailableError()
  }

  const count = result[0].result
  const pttl = result[2].result
  return {
    limited: count > limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: Math.ceil(Math.max(0, pttl) / 1000),
  }
}

/** Clear a counter, e.g. after a successful login. */
export async function rateLimitReset(key: string): Promise<void> {
  memory.delete(key)
  const backend = rateLimitBackend()
  if (backend === "mongodb") {
    try {
      await (await mongoCollection()).deleteOne({ _id: mongoKey(key) })
    } catch (error) {
      console.error("[rate-limit] MongoDB reset failed", error instanceof Error ? error.name : "UnknownError")
      throw new RateLimitUnavailableError()
    }
  } else if (backend === "upstash") {
    await upstashPipeline([["DEL", key]])
  }
}

/** Seconds until `key`'s window resets, without counting a request against it. */
export async function rateLimitResetSeconds(key: string): Promise<number> {
  const backend = rateLimitBackend()
  if (backend === "memory") {
    const entry = memory.get(key)
    if (!entry) return 0
    return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000))
  }
  if (backend === "mongodb") {
    try {
      const counter = await (await mongoCollection()).findOne({ _id: mongoKey(key) }, { projection: { resetAt: 1 } })
      if (!counter) return 0
      if (!Number.isFinite(Number(counter.resetAt))) throw new RateLimitUnavailableError()
      return Math.max(0, Math.ceil((Number(counter.resetAt) - Date.now()) / 1000))
    } catch (error) {
      console.error("[rate-limit] MongoDB status failed", error instanceof Error ? error.name : "UnknownError")
      throw new RateLimitUnavailableError()
    }
  }
  const result = await upstashPipeline([["PTTL", key]])
  if (typeof result[0]?.result !== "number") throw new RateLimitUnavailableError()
  const pttl = result[0].result
  return Math.max(0, Math.ceil(pttl / 1000))
}
