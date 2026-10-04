/**
 * POST /api/v1/auth/google — native Google sign-in.
 *
 * The native SDK performs the interactive flow on-device and returns an ID
 * token; we verify it and mint the same token pair `/api/v1/auth/login` issues.
 */

import { NextRequest, NextResponse } from "next/server"
import { buildSessionPayload } from "@/lib/auth-credentials"
import { resolveGoogleUser, verifyGoogleIdToken } from "@/lib/auth-google"
import { createPendingSignupToken, PENDING_SIGNUP_TTL_SECONDS } from "@/lib/pending-signup"
import { PRIVACY_NOTICE_VERSION } from "@/lib/dpdp-config"
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

    const resolved = await resolveGoogleUser(verified.identity)

    /**
     * First time we've seen this Google account. We deliberately have not
     * created anything yet — DPDP sections 6 and 9 require the privacy notice
     * and an age check first, and for a child the correct outcome is that no
     * record ever existed. The client must collect those and call
     * `/api/v1/auth/google/complete` with this token.
     */
    if (resolved.status === "onboarding_required") {
      return NextResponse.json(
        {
          error: "onboarding_required",
          code: "DPDP_ONBOARDING_REQUIRED",
          message: "Tell us your date of birth and accept the privacy notice to finish signing up.",
          onboardingToken: createPendingSignupToken(verified.identity),
          expiresIn: PENDING_SIGNUP_TTL_SECONDS,
          noticeVersion: PRIVACY_NOTICE_VERSION,
          email: verified.identity.email,
          name: verified.identity.name ?? null,
        },
        { status: 428, headers: { "Cache-Control": "private, no-store" } },
      )
    }

    const user = resolved.user
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
