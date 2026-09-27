/**
 * Google identity shared by the web OAuth callback and the native sign-in route.
 *
 * The web flow is redirect-based (`/api/auth/google`), which a native app cannot
 * use. Native SDKs instead hand the app a signed ID token, which we verify here.
 */

import { connectToDatabase } from "@/lib/mongodb"
import type { AuthenticatedUser } from "@/lib/auth-credentials"

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

/** Find or create the local user behind a verified Google identity. */
export async function findOrCreateGoogleUser(identity: GoogleIdentity): Promise<AuthenticatedUser> {
  const { db } = await connectToDatabase()
  const users = db.collection("users")

  let user = await users.findOne({ email: identity.email })

  if (!user) {
    const now = new Date()
    const doc = {
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
    const result = await users.insertOne(doc)
    user = { ...doc, _id: result.insertedId }
  } else if (!user.authProvider) {
    // Pre-existing password account signing in with Google for the first time.
    // Google has already proven ownership of the address, so mark it verified.
    await users.updateOne(
      { _id: user._id },
      { $set: { authProvider: "google", emailVerified: true, updatedAt: new Date() } },
    )
    user.authProvider = "google"
    user.emailVerified = true
  }

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
