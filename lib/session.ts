/**
 * Signed session tokens.
 *
 * Dependency-free, runs in BOTH the Edge runtime (middleware) and the Node
 * runtime (route handlers / server components) because it only uses Web Crypto
 * (`crypto.subtle`), `TextEncoder`, and `btoa`/`atob` — no `Buffer`, no Node
 * built-ins.
 *
 * A token is `base64url(payload).base64url(hmacSha256(payload))`. The payload
 * is the source of truth for authorization on the server; it is signed with a
 * server-only secret so it cannot be forged or tampered with by the client.
 */

export const SESSION_COOKIE = "session"
export const SESSION_MAX_AGE = 60 * 60 * 24 // 24 hours (seconds)

export interface SessionPayload {
  id: string
  email: string
  /** Display name. Optional so tokens issued before this field shipped still verify. */
  name?: string
  role: "admin" | "user" | "vendor" | "superadmin"
  dashboardAccess?: boolean
  allowedPages?: string[]
  /** Expiry, epoch seconds. */
  exp: number
}

let warnedAboutSecret = false
function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ""
  if (
    !secret &&
    process.env.NODE_ENV === "production" &&
    !warnedAboutSecret
  ) {
    // Log once per process so misconfiguration is obvious in the runtime
    // logs without flooding them on every request.
    console.error(
      "[session] SESSION_SECRET/NEXTAUTH_SECRET is not set in production. " +
        "All session verification will fail and users will appear logged out. " +
        "Set a strong 32+ character secret in your hosting environment.",
    )
    warnedAboutSecret = true
  }
  return secret
}

/**
 * Throttled, structured log of why a session token was rejected. We don't
 * want to spam logs on every request, but we do want enough signal in
 * production to diagnose the very common "the cookie is there but the
 * server says I'm not logged in" problem — the usual root cause is a
 * missing or rotated SESSION_SECRET (so the signature doesn't match) or
 * a token that was issued by an older build with a different secret.
 */
let logBucket: Record<string, { count: number; lastAt: number }> = {}
function logReject(reason: string, extra: Record<string, unknown> = {}) {
  const now = Date.now()
  const entry = logBucket[reason] || { count: 0, lastAt: 0 }
  // Always log the first occurrence; thereafter at most once every 5 minutes.
  if (entry.count === 0 || now - entry.lastAt > 5 * 60 * 1000) {
    console.warn(
      `[session] verify rejected: ${reason}`,
      JSON.stringify({ ...extra, count: entry.count + 1 }),
    )
    entry.count += 1
    entry.lastAt = now
    logBucket[reason] = entry
  }
}

function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  // Try the standard Base64 -> Base64URL transformation. We need a path
  // that works in ALL of: modern browsers, Edge runtime, and Node.
  //
  //   1. Prefer `btoa` (browsers, Edge runtime, modern Node).
  //   2. Otherwise use Node `Buffer` (older server runtimes).
  //
  // Critically, do NOT reach for `Buffer` in a path that might run in
  // the Edge runtime — `Buffer` is undefined there and the require()
  // would throw synchronously, breaking session verification.
  if (typeof btoa === "function") {
    let binary = ""
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  }

  if (isEdgeRuntime) {
    // Edge runtime but no `btoa` — this should never happen on a properly
    // configured Vercel Edge deployment, but if it does, fail loudly
    // instead of silently producing a wrong signature.
    throw new Error(
      "Neither btoa nor Buffer is available in the Edge runtime. " +
        "Cannot encode base64url for session signing.",
    )
  }

  // Node fallback
  const base64 = Buffer.from(bytes).toString("base64")
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/")
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4)

  // Same pattern as bytesToBase64Url: prefer atob, fall back to Buffer
  // only outside the Edge runtime.
  if (typeof atob === "function") {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  if (isEdgeRuntime) {
    throw new Error(
      "Neither atob nor Buffer is available in the Edge runtime. " +
        "Cannot decode base64url for session verification.",
    )
  }

  const binary = Buffer.from(padded, "base64").toString("binary")
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Runtime detection. On Vercel, middleware runs in the Edge runtime
 * (no Node built-ins), while API routes / Server Components run in the
 * Node runtime. Trying to `require("crypto")` in the Edge runtime
 * throws synchronously, which previously caused `hmac()` to fall through
 * to a throwing branch and made `verifySessionToken` return `null` for
 * every request — logging the user out instantly. We now detect the
 * Edge runtime explicitly and skip the Node fallback there.
 */
const isEdgeRuntime =
  typeof (globalThis as { EdgeRuntime?: string }).EdgeRuntime === "string"

async function hmac(data: string): Promise<Uint8Array> {
  const secret = getSecret()
  // Web Crypto Subtle is available in both Edge runtime and Node 20+.
  // It is the only safe path for Edge — `require("crypto")` would throw
  // there because Node built-ins are not bundled.
  try {
    if (typeof crypto !== "undefined" && (crypto as any).subtle) {
      const key = await (crypto as any).subtle.importKey(
        "raw",
        utf8ToBytes(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      )
      const sig = await (crypto as any).subtle.sign("HMAC", key, utf8ToBytes(data))
      return new Uint8Array(sig)
    }
  } catch (e) {
    if (isEdgeRuntime) {
      // Don't silently fall through to Node `require` in Edge — it WILL
      // throw, and a swallowed throw here is what caused sessions to
      // fail to verify on production. Surface the error instead.
      throw new Error(
        `Web Crypto Subtle HMAC failed in Edge runtime: ${String(e)}. ` +
          `This usually means the deployment runtime does not support ` +
          `crypto.subtle. Check your hosting environment.`,
      )
    }
    // Node runtime: fall through to the createHmac fallback.
  }

  // Node fallback using crypto.createHmac. Only reachable in the Node
  // runtime; in Edge runtime we either succeeded above or threw.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require("crypto")
    const h = nodeCrypto.createHmac("sha256", secret)
    h.update(data)
    const buf: Buffer = h.digest()
    return new Uint8Array(buf)
  } catch (err) {
    throw new Error("No suitable crypto implementation available for HMAC")
  }
}

/** Constant-time string comparison. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Create a signed session token. Throws when no signing secret is configured
 * so misconfiguration fails loudly at login rather than silently shipping an
 * unverifiable token.
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, "exp"> & { exp?: number },
): Promise<string> {
  const secret = getSecret()
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET (or NEXTAUTH_SECRET) is missing or too short; set a strong 32+ char secret.",
    )
  }
  const full: SessionPayload = {
    ...payload,
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  }
  const payloadB64 = bytesToBase64Url(utf8ToBytes(JSON.stringify(full)))
  const sigB64 = bytesToBase64Url(await hmac(payloadB64))
  return `${payloadB64}.${sigB64}`
}

/**
 * Verify a session token and return its payload, or `null` when the token is
 * missing, malformed, tampered, expired, or no secret is configured. Always
 * fails closed (treats invalid as logged-out).
 */
export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  try {
    if (!token) {
      logReject("missing_token")
      return null
    }
    const secret = getSecret()
    if (!secret || secret.length < 16) {
      logReject("missing_or_short_secret", { secretLen: secret?.length || 0 })
      return null
    }

    const dot = token.indexOf(".")
    if (dot <= 0) {
      logReject("malformed_no_dot", { tokenPrefix: token.slice(0, 8) })
      return null
    }
    const payloadB64 = token.slice(0, dot)
    const sigB64 = token.slice(dot + 1)

    const expectedSig = bytesToBase64Url(await hmac(payloadB64))
    if (!timingSafeEqual(sigB64, expectedSig)) {
      logReject("signature_mismatch", {
        tokenSigLen: sigB64.length,
        expectedSigLen: expectedSig.length,
      })
      return null
    }

    let json: string
    try {
      json = new TextDecoder().decode(base64UrlToBytes(payloadB64))
    } catch (e) {
      logReject("payload_decode_error", { err: String(e) })
      return null
    }

    let payload: SessionPayload
    try {
      payload = JSON.parse(json) as SessionPayload
    } catch (e) {
      logReject("payload_json_error", { err: String(e) })
      return null
    }

    if (!payload?.id || !payload?.exp) {
      logReject("payload_invalid_shape", { hasId: !!payload?.id, hasExp: !!payload?.exp })
      return null
    }
    if (Math.floor(Date.now() / 1000) >= payload.exp) {
      logReject("payload_expired", { exp: payload.exp, now: Math.floor(Date.now() / 1000) })
      return null
    }

    return payload
  } catch (e) {
    logReject("unexpected_error", { err: String(e) })
    return null
  }
}

/** Extract the raw session token from a Cookie header string. */
export function getSessionTokenFromCookieHeader(
  cookieHeader: string | null | undefined,
): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=")
    if (name === SESSION_COOKIE) return rest.join("=")
  }
  return undefined
}
