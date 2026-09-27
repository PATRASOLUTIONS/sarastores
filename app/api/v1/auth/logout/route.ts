/**
 * POST /api/v1/auth/logout — revoke a native session.
 *
 * `allDevices: true` signs the account out everywhere, which is what the
 * account-security screen and a password change both need.
 */

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { revokeAllForUser, revokeRefreshToken } from "@/lib/refresh-tokens"

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
      const revoked = await revokeAllForUser(session.user.id, "logout_all_devices")
      return NextResponse.json({ success: true, revoked })
    }

    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 })
    }

    // Always report success: revoking an unknown token is indistinguishable
    // from revoking a valid one, and the end state the client wants is the same.
    await revokeRefreshToken(refreshToken, "logout")
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v1/auth/logout] error", error)
    return NextResponse.json({ error: "An error occurred during logout." }, { status: 500 })
  }
}
