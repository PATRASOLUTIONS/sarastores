/**
 * POST /api/v1/auth/refresh — exchange a refresh token for a new token pair.
 *
 * The presented refresh token is retired in the same call. Replaying one is
 * treated as theft and revokes every token in its family.
 */

import { NextRequest, NextResponse } from "next/server"
import { buildSessionPayload, getAuthenticatedUserById } from "@/lib/auth-credentials"
import { createSessionToken } from "@/lib/session"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  rotateRefreshToken,
  revokeAllForUser,
  type DeviceInfo,
} from "@/lib/refresh-tokens"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const refreshToken = typeof body?.refreshToken === "string" ? body.refreshToken.trim() : ""
    if (!refreshToken) {
      return NextResponse.json({ error: "refreshToken is required" }, { status: 400 })
    }

    const device: DeviceInfo = body?.device ?? {}
    const rotated = await rotateRefreshToken(refreshToken, device)
    if (!rotated.ok) {
      // Every failure mode looks the same to the client: sign in again. The
      // specific reason is only useful to an attacker probing for valid tokens.
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 })
    }

    // Re-read the user so a role change, or a deactivated account, takes effect
    // now rather than at the end of the refresh token's 60-day life.
    const user = await getAuthenticatedUserById(rotated.userId)
    if (!user) {
      await revokeAllForUser(rotated.userId, "user_missing_or_inactive")
      return NextResponse.json({ error: "Account is no longer active" }, { status: 401 })
    }

    const accessToken = await createSessionToken({
      ...buildSessionPayload(user),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    })

    return NextResponse.json(
      {
        tokenType: "Bearer",
        accessToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: rotated.token,
        refreshExpiresAt: rotated.expiresAt.toISOString(),
        user,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[v1/auth/refresh] error", error)
    return NextResponse.json({ error: "An error occurred while refreshing the session." }, { status: 500 })
  }
}
