/**
 * Pending-signup tokens — DPDP Act 2023, Sections 6 and 9.
 *
 * Google sign-in used to create the local user the moment Google confirmed the
 * email. That quietly bypassed the age gate and the consent capture that the
 * password signup enforces: a 12-year-old with a Gmail account became a fully
 * provisioned Data Principal without anyone ever seeing the Section 5 notice.
 *
 * Creating the record *is* the processing, so the fix cannot be an interstitial
 * shown after the account exists. Instead the verified Google identity is held
 * in a short-lived signed token handed back to the client, and the user row is
 * only written once date of birth and consent come back. If the person turns
 * out to be a child, nothing was ever stored.
 *
 * The token is signed, not encrypted: it rides through a browser redirect, so
 * treat its contents as readable by the holder. It carries nothing the holder
 * did not just authenticate as.
 *
 * Node runtime only — unlike `lib/session.ts` this is never imported by
 * middleware, so `node:crypto` is safe here.
 */

import { createHmac, timingSafeEqual } from "node:crypto"

/** Long enough to fill in a date of birth, short enough to be useless if leaked. */
export const PENDING_SIGNUP_TTL_SECONDS = 15 * 60

const PURPOSE = "google_signup" as const

export interface PendingSignupPayload {
  purpose: typeof PURPOSE
  email: string
  name?: string
  picture?: string | null
  exp: number
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET (or NEXTAUTH_SECRET) must be set and at least 16 characters " +
        "to sign pending-signup tokens.",
    )
  }
  return secret
}

const b64url = (input: string | Buffer): string =>
  Buffer.from(input).toString("base64url")

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url")
}

export function createPendingSignupToken(identity: {
  email: string
  name?: string
  picture?: string | null
}): string {
  const payload: PendingSignupPayload = {
    purpose: PURPOSE,
    email: identity.email.toLowerCase(),
    name: identity.name,
    picture: identity.picture ?? null,
    exp: Math.floor(Date.now() / 1000) + PENDING_SIGNUP_TTL_SECONDS,
  }
  const encoded = b64url(JSON.stringify(payload))
  return `${encoded}.${sign(encoded)}`
}

/** Returns the payload only for a token we signed, that has not expired. */
export function verifyPendingSignupToken(token: string): PendingSignupPayload | null {
  if (!token || typeof token !== "string") return null

  const parts = token.split(".")
  if (parts.length !== 2) return null
  const [encoded, signature] = parts

  // Constant-time compare so a caller cannot probe for a valid signature.
  const expected = Buffer.from(sign(encoded))
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return null
  if (!timingSafeEqual(expected, received)) return null

  let payload: PendingSignupPayload
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))
  } catch {
    return null
  }

  if (payload?.purpose !== PURPOSE) return null
  if (typeof payload.email !== "string" || !payload.email) return null
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null

  return payload
}
