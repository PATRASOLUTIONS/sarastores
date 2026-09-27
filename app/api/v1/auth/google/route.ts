/**
 * POST /api/v1/auth/google — native Google sign-in.
 *
 * The native SDK performs the interactive flow on-device and returns an ID
 * token; we verify it and mint the same token pair `/api/v1/auth/login` issues.
 */

import { NextRequest, NextResponse } from "next/server"
import { buildSessionPayload } from "@/lib/auth-credentials"
import { findOrCreateGoogleUser, verifyGoogleIdToken } from "@/lib/auth-google"
import { createSessionToken } from "@/lib/session"
import { ACCESS_TOKEN_TTL_SECONDS, issueRefreshToken, type DeviceInfo } from "@/lib/refresh-tokens"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const idToken = typeof body?.idToken === "string" ? body.idToken.trim() : ""
    if (!idToken) {
      return NextResponse.json({ error: "idToken is required" }, { status: 400 })
    }

    const verified = await verifyGoogleIdToken(idToken)
    if (!verified.ok) {
      return NextResponse.json({ error: verified.message }, { status: verified.status })
    }

    const user = await findOrCreateGoogleUser(verified.identity)
    const device: DeviceInfo = body?.device ?? {}

    const accessToken = await createSessionToken({
      ...buildSessionPayload(user),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    })
    const refresh = await issueRefreshToken(user.id, device)

    return NextResponse.json(
      {
        tokenType: "Bearer",
        accessToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: refresh.token,
        refreshExpiresAt: refresh.expiresAt.toISOString(),
        user,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[v1/auth/google] error", error)
    return NextResponse.json({ error: "An error occurred during Google sign-in." }, { status: 500 })
  }
}
