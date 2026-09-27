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
 * Falls back to the previous in-memory behaviour when it is not configured, so
 * local development and unconfigured deploys keep working.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export type RateLimitBackend = "upstash" | "memory"

export function rateLimitBackend(): RateLimitBackend {
  return UPSTASH_URL && UPSTASH_TOKEN ? "upstash" : "memory"
}

export interface RateLimitResult {
  limited: boolean
  remaining: number
  /** Seconds until the window resets. */
  resetSeconds: number
}

const memory = new Map<string, { count: number; resetAt: number }>()

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

async function upstashPipeline(commands: (string | number)[][]): Promise<any[] | null> {
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${UPSTASH_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      console.warn("[rate-limit] upstash returned", res.status)
      return null
    }
    return await res.json()
  } catch (error) {
    console.warn("[rate-limit] upstash unreachable", error)
    return null
  }
}

/**
 * Count one request against `key`. Returns whether the caller is over the limit.
 *
 * Fixed window rather than sliding: it needs one round trip instead of a sorted
 * set, and the difference does not matter for abuse prevention at these limits.
 */
export async function rateLimitHit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (rateLimitBackend() === "memory") return memoryHit(key, limit, windowMs)

  // PEXPIRE ... NX only sets a TTL when the key has none, so a crash between
  // INCR and PEXPIRE cannot leave a counter that never expires.
  const result = await upstashPipeline([
    ["INCR", key],
    ["PEXPIRE", key, windowMs, "NX"],
    ["PTTL", key],
  ])

  if (!result || typeof result[0]?.result !== "number") {
    // Never fail a login because the counter store is down.
    return memoryHit(key, limit, windowMs)
  }

  const count = result[0].result as number
  const pttl = typeof result[2]?.result === "number" ? (result[2].result as number) : windowMs
  return {
    limited: count > limit,
    remaining: Math.max(0, limit - count),
    resetSeconds: Math.ceil(Math.max(0, pttl) / 1000),
  }
}

/** Clear a counter, e.g. after a successful login. */
export async function rateLimitReset(key: string): Promise<void> {
  memory.delete(key)
  if (rateLimitBackend() === "upstash") {
    await upstashPipeline([["DEL", key]])
  }
}

/** Seconds until `key`'s window resets, without counting a request against it. */
export async function rateLimitResetSeconds(key: string): Promise<number> {
  if (rateLimitBackend() === "memory") {
    const entry = memory.get(key)
    if (!entry) return 0
    return Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000))
  }
  const result = await upstashPipeline([["PTTL", key]])
  const pttl = typeof result?.[0]?.result === "number" ? (result[0].result as number) : 0
  return Math.max(0, Math.ceil(pttl / 1000))
}
