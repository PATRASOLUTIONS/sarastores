/**
 * POST /api/v1/auth/logout — revoke a native session.
 *
 * `allDevices: true` signs the account out everywhere, which is what the
 * account-security screen and a password change both need.
 */

import { NextRequest, NextResponse } from "next/server"
import { getRequestSessionToken, getSession } from "@/lib/auth"
import { revokeAllForUser, revokeRefreshToken } from "@/lib/refresh-tokens"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { verifySessionToken } from "@/lib/session"
import { revokeSessionToken } from "@/lib/session-revocation"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : ""

    if (body?.allDevices) {
      const session = await getSession()
      if (!session) {
        return NextResponse.json({ error: "Authentication required" }, { status: 401 })
      }
      // Retire already-issued access tokens as well as refresh tokens. Rotation
      // also checks this live version, so an interrupted cleanup stays closed.
      const users = await getCollection("users")
      const invalidated = await users.updateOne(
        { _id: new ObjectId(session.user.id) },
        { $inc: { sessionVersion: 1 } },
      )
      if (!invalidated.acknowledged || !invalidated.matchedCount) {
        throw new Error("Account sessions could not be invalidated")
      }
      const revoked = await revokeAllForUser(session.user.id, "logout_all_devices")
      return NextResponse.json({ success: true, revoked })
    }

    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 })
    }

    // Always report success: revoking an unknown token is indistinguishable
    // from revoking a valid one, and the end state the client wants is the same.
    await revokeRefreshToken(refreshToken, "logout")
    const token = await getRequestSessionToken()
    const payload = await verifySessionToken(token)
    if (token && payload) await revokeSessionToken(token, payload.exp)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v1/auth/logout] error", error)
    return NextResponse.json({ error: "An error occurred during logout." }, { status: 500 })
  }
}
