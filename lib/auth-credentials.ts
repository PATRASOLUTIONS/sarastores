/**
 * Credential verification shared by the web login route (cookie session) and
 * the native login route (bearer + refresh tokens).
 *
 * Both surfaces must agree on exactly what counts as a valid login, so the
 * check lives here rather than being duplicated per transport.
 */

import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { connectToDatabase } from "@/lib/mongodb"
import type { SessionPayload } from "@/lib/session"

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  role: string
  emailVerified: boolean
  createdAt?: Date | string | null
  avatar: string | null
  phone: string | null
  address: string | null
  dashboardAccess: boolean
  allowedPages: string[]
}

export type CredentialResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; status: number; message: string }

/** Verifies email + password and returns the user without its password hash. */
export async function verifyCredentials(email: string, password: string): Promise<CredentialResult> {
  let user: any = null
  let usersCollection: any = null
  try {
    const conn = await connectToDatabase()
    usersCollection = conn.db.collection("users")
    user = await usersCollection.findOne({ email: email.toLowerCase() })
  } catch (dbError) {
    // A database outage is a 503, never "invalid credentials" — reporting it as
    // a 401 sends users to reset a password that was never wrong.
    console.error("Database authentication error:", dbError)
    return { ok: false, status: 503, message: "Unable to reach the authentication service. Please try again." }
  }

  const isPasswordValid = !!user && !!user.password && (await bcrypt.compare(password, user.password))
  if (!user || !isPasswordValid) {
    return { ok: false, status: 401, message: "Invalid email or password" }
  }
  if (user.status === "inactive") {
    return { ok: false, status: 403, message: "This staff account is inactive" }
  }

  try {
    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date(), updatedAt: new Date() } },
    )
  } catch (updateError) {
    console.warn("[Auth] Failed to update lastLogin", updateError)
  }

  return {
    ok: true,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || "user",
      emailVerified: user.emailVerified || false,
      createdAt: user.createdAt,
      avatar: user.avatar || null,
      phone: user.phone || null,
      address: user.address || null,
      dashboardAccess: !!user.dashboardAccess,
      allowedPages: Array.isArray(user.allowedPages) ? user.allowedPages : [],
    },
  }
}

/**
 * Re-read a user for token refresh, so a role change or a deactivated account
 * takes effect on the next refresh instead of persisting for the life of the
 * refresh token.
 */
export async function getAuthenticatedUserById(userId: string): Promise<AuthenticatedUser | null> {
  if (!ObjectId.isValid(userId)) return null
  try {
    const { db } = await connectToDatabase()
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) })
    if (!user || user.status === "inactive") return null
    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || "user",
      emailVerified: user.emailVerified || false,
      createdAt: user.createdAt,
      avatar: user.avatar || null,
      phone: user.phone || null,
      address: user.address || null,
      dashboardAccess: !!user.dashboardAccess,
      allowedPages: Array.isArray(user.allowedPages) ? user.allowedPages : [],
    }
  } catch (error) {
    console.error("[Auth] Failed to load user for refresh", error)
    return null
  }
}

/**
 * Build the signed-token payload, trimming `allowedPages` so the result stays
 * under the ~4 KB browser cookie cap. Over that limit the browser silently
 * drops the cookie and the user is logged out on the next request — the classic
 * symptom for staff accounts with many page grants.
 */
export function buildSessionPayload(user: AuthenticatedUser): Omit<SessionPayload, "exp"> {
  const safeAllowed = (Array.isArray(user.allowedPages) ? user.allowedPages : [])
    .map((p) => String(p).slice(0, 200))
    .filter(Boolean)
    .slice(0, 200)

  const payload = {
    id: user.id,
    email: user.email,
    name: String(user.name || "").slice(0, 80),
    role: user.role as SessionPayload["role"],
    dashboardAccess: user.dashboardAccess,
    allowedPages: safeAllowed,
  }

  try {
    if (JSON.stringify(payload).length > 2500) {
      console.warn("[Auth] Session payload too large; omitting allowedPages")
      payload.allowedPages = []
    }
  } catch {
    payload.allowedPages = []
  }

  return payload
}
