/**
 * The caller's network address, for rate limiting and abuse counters.
 *
 * Every forwarding header is attacker-controlled unless a trusted proxy
 * overwrites it. The previous implementations read `cf-connecting-ip` and
 * `x-real-ip` first and took the *leftmost* entry of `x-forwarded-for` — all
 * three are values a client can simply set, so rotating one of them handed
 * every request a fresh rate-limit bucket and defeated the limiter entirely.
 *
 * Trust order here:
 *
 *  1. `x-vercel-forwarded-for` — written by the Vercel edge on every request
 *     and not forgeable by the caller. This is the deployment target.
 *  2. The *rightmost* entry of `x-forwarded-for` — appended by the nearest
 *     proxy, so it is the only entry a client cannot choose. Values the client
 *     invented sit to the left of it.
 *  3. `cf-connecting-ip`, but only when `TRUST_CLOUDFLARE_IP=true` declares
 *     that Cloudflare really is in front and overwrites the header.
 *
 * Falling back to a single shared `"unknown"` bucket is deliberate: an
 * unidentifiable caller should share one tight budget rather than be exempt.
 */

type HeaderSource = { headers: { get(name: string): string | null } }

function firstAddress(value: string | null): string | null {
  if (!value) return null
  const first = value.split(",")[0]?.trim()
  return first || null
}

function lastAddress(value: string | null): string | null {
  if (!value) return null
  const parts = value.split(",").map((part) => part.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : null
}

export function clientAddress(request: HeaderSource): string {
  const platform = firstAddress(request.headers.get("x-vercel-forwarded-for"))
  if (platform) return platform

  if (process.env.TRUST_CLOUDFLARE_IP === "true") {
    const cloudflare = request.headers.get("cf-connecting-ip")?.trim()
    if (cloudflare) return cloudflare
  }

  const nearestProxy = lastAddress(request.headers.get("x-forwarded-for"))
  if (nearestProxy) return nearestProxy

  return "unknown"
}
