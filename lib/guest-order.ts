import crypto from "crypto"

/**
 * Guest order access tokens.
 *
 * A guest has no session, so the only way to let them view the order they just
 * placed is a capability token. It is generated once, returned once, and stored
 * only as a SHA-256 hash — the same treatment as an API key, so a database leak
 * does not hand out order access.
 *
 * Order ids are sequential (`SARAECOM-<seq>`), so they must never be sufficient
 * on their own to read an order.
 */

const TOKEN_BYTES = 32

export function createGuestAccessToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString("base64url")
}

export function hashGuestAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

/** Constant-time comparison so a token cannot be recovered by timing. */
export function verifyGuestAccessToken(token: unknown, storedHash: unknown): boolean {
  if (typeof token !== "string" || typeof storedHash !== "string") return false
  if (token.length === 0 || storedHash.length !== 64) return false

  const candidate = Buffer.from(hashGuestAccessToken(token), "hex")
  const expected = Buffer.from(storedHash, "hex")
  if (candidate.length !== expected.length) return false

  return crypto.timingSafeEqual(candidate, expected)
}
