/**
 * Google identity shared by the web OAuth callback and the native sign-in route.
 *
 * The web flow is redirect-based (`/api/auth/google`), which a native app cannot
 * use. Native SDKs instead hand the app a signed ID token, which we verify here.
 */

import { connectToDatabase } from "@/lib/mongodb"
import type { NextRequest } from "next/server"
import type { AuthenticatedUser } from "@/lib/auth-credentials"
import { recordConsent, CONSENT_PURPOSES } from "@/lib/consent"

export interface GoogleIdentity {
  email: string
  name?: string
  picture?: string | null
  emailVerified: boolean
}

/**
 * Every platform gets its own OAuth client ID, so a token minted for the iOS
 * client carries a different `aud` than the web one. All of them are valid for
 * this backend; anything else is a token minted for a different app.
 */
function allowedAudiences(): string[] {
  return [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_EXPO_CLIENT_ID,
  ].filter((value): value is string => !!value && value.length > 0)
}

export type VerifyIdTokenResult =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; status: number; message: string }

/**
 * Verify a Google ID token via Google's tokeninfo endpoint, which checks the
 * signature, issuer and expiry for us. We still have to check `aud` ourselves —
 * a validly signed token issued to some other app is not proof of anything here.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<VerifyIdTokenResult> {
  const audiences = allowedAudiences()
  if (audiences.length === 0) {
    console.error("[auth/google] no GOOGLE_*_CLIENT_ID configured")
    return { ok: false, status: 500, message: "Google sign-in is not configured" }
  }

  let payload: Record<string, string> | null = null
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return { ok: false, status: 401, message: "Invalid Google token" }
    payload = await res.json()
  } catch (error) {
    console.error("[auth/google] tokeninfo request failed", error)
    return { ok: false, status: 503, message: "Could not reach Google to verify sign-in" }
  }

  if (!payload?.aud || !audiences.includes(payload.aud)) {
    console.warn("[auth/google] token audience rejected", { aud: payload?.aud })
    return { ok: false, status: 401, message: "Invalid Google token" }
  }
  if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") {
    return { ok: false, status: 401, message: "Invalid Google token" }
  }
  if (!payload.email) {
    return { ok: false, status: 400, message: "Google account has no email address" }
  }
  if (payload.email_verified !== "true" && payload.email_verified !== "1") {
    return { ok: false, status: 403, message: "Google account email is not verified" }
  }

  return {
    ok: true,
    identity: {
      email: payload.email.toLowerCase(),
      name: payload.name,
      picture: payload.picture ?? null,
      emailVerified: true,
    },
  }
}

function toAuthenticatedUser(user: Record<string, any>): AuthenticatedUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role || "user",
    emailVerified: !!user.emailVerified,
    createdAt: user.createdAt,
    avatar: user.avatar || null,
    phone: user.phone || null,
    address: user.address || null,
    dashboardAccess: !!user.dashboardAccess,
    allowedPages: Array.isArray(user.allowedPages) ? user.allowedPages : [],
  }
}

export type ResolveGoogleUserResult =
  /** The account already exists; sign them straight in. */
  | { status: "existing"; user: AuthenticatedUser }
  /**
   * No local account yet. We must not create one until the person accepts the
   * terms and has been shown the privacy notice, so the caller has to run the
   * onboarding step before any record is written.
   */
  | { status: "onboarding_required" }

/**
 * Resolve a verified Google identity to a local account **without ever creating
 * one**. Creation is deliberately a separate, consent-gated step — see
 * `createGoogleUser`.
 */
export async function resolveGoogleUser(identity: GoogleIdentity): Promise<ResolveGoogleUserResult> {
  const { db } = await connectToDatabase()
  const users = db.collection("users")

  const user = await users.findOne({ email: identity.email })
  if (!user) return { status: "onboarding_required" }

  if (!user.authProvider) {
    // Pre-existing password account signing in with Google for the first time.
    // Google has already proven ownership of the address, so mark it verified.
    // This links an existing Data Principal rather than creating a new one —
    // consent was captured at their original signup.
    await users.updateOne(
      { _id: user._id },
      { $set: { authProvider: "google", emailVerified: true, updatedAt: new Date() } },
    )
    user.authProvider = "google"
    user.emailVerified = true
  }

  return { status: "existing", user: toAuthenticatedUser(user) }
}

export interface GoogleOnboarding {
  marketingEmail?: boolean
  marketingWhatsapp?: boolean
  marketingSms?: boolean
  noticeVersion?: string
}

export type CreateGoogleUserResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: number; code: string; message: string }

/**
 * Create the local account for a verified Google identity once consent has
 * been established.
 */
export async function createGoogleUser(
  identity: GoogleIdentity,
  onboarding: GoogleOnboarding,
  request?: NextRequest,
): Promise<CreateGoogleUserResult> {
  const { db } = await connectToDatabase()
  const users = db.collection("users")

  // The form may have sat open while another tab or device created the account.
  // Treat that as a plain sign-in rather than an error.
  const existing = await users.findOne({ email: identity.email })
  if (existing) return { ok: true, user: toAuthenticatedUser(existing) }

  const now = new Date()
  const doc: Record<string, any> = {
    name: identity.name || identity.email.split("@")[0] || "Google User",
    email: identity.email,
    password: null,
    role: "user",
    emailVerified: true,
    avatar: identity.picture || null,
    authProvider: "google",
    createdAt: now,
    updatedAt: now,
    cart: [],
    wishlist: [],
    orders: [],
  }

  let insertedId
  try {
    const result = await users.insertOne(doc)
    insertedId = result.insertedId
  } catch (error) {
    // Lost a race against a concurrent signup for the same address.
    const raced = await users.findOne({ email: identity.email })
    if (raced) return { ok: true, user: toAuthenticatedUser(raced) }
    throw error
  }

  const userId = insertedId.toString()
  const noticeVersion = onboarding.noticeVersion

  // Section 8(4) puts the burden of proving consent on us, so every decision
  // made on the onboarding form is written to the ledger — refusals included.
  await recordConsent({
    userId,
    source: "signup",
    noticeVersion,
    request,
    decisions: [
      { purpose: CONSENT_PURPOSES.ACCOUNT, granted: true },
      { purpose: CONSENT_PURPOSES.MARKETING_EMAIL, granted: !!onboarding.marketingEmail },
      { purpose: CONSENT_PURPOSES.MARKETING_WHATSAPP, granted: !!onboarding.marketingWhatsapp },
      { purpose: CONSENT_PURPOSES.MARKETING_SMS, granted: !!onboarding.marketingSms },
    ],
  })

  // Mirror the marketing choices onto the profile the campaign jobs read.
  if (onboarding.marketingEmail || onboarding.marketingWhatsapp || onboarding.marketingSms) {
    try {
      const { setConsent } = await import("@/lib/customer-profile")
      await setConsent(
        userId,
        {
          email: !!onboarding.marketingEmail,
          whatsapp: !!onboarding.marketingWhatsapp,
          sms: !!onboarding.marketingSms,
        },
        "signup",
      )
    } catch (consentError) {
      console.error("[auth/google] failed to seed marketing consent profile", consentError)
    }
  }

  return { ok: true, user: toAuthenticatedUser({ ...doc, _id: insertedId }) }
}
