/**
 * POST /api/v1/auth/google/complete — finish a Google sign-up.
 *
 * `/api/v1/auth/google` returns 428 with an `onboardingToken` the first time it
 * sees a Google account, because the privacy notice and terms must be accepted
 * before the account is created. This route creates the account once those
 * choices are supplied.
 *
 * The Google identity comes from the signed token, never from the request body —
 * otherwise anyone could mint an account for any email address.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { buildSessionPayload } from "@/lib/auth-credentials"
import { createGoogleUser } from "@/lib/auth-google"
import { verifyPendingSignupToken } from "@/lib/pending-signup"
import { createSessionToken } from "@/lib/session"
import { ACCESS_TOKEN_TTL_SECONDS, issueRefreshToken, type DeviceInfo } from "@/lib/refresh-tokens"

export const dynamic = "force-dynamic"

const CompleteSchema = z.object({
  onboardingToken: z.string().min(1, "onboardingToken is required"),
  acceptPrivacyNotice: z.literal(true, {
    errorMap: () => ({ message: "You must confirm you have read the privacy notice" }),
  }),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms and conditions" }),
  }),
  marketingEmail: z.boolean().optional().default(false),
  marketingWhatsapp: z.boolean().optional().default(false),
  marketingSms: z.boolean().optional().default(false),
  noticeVersion: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const parsed = CompleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      )
    }

    const pending = verifyPendingSignupToken(parsed.data.onboardingToken)
    if (!pending) {
      return NextResponse.json(
        {
          error: "Your sign-up session expired. Please sign in with Google again.",
          code: "ONBOARDING_TOKEN_INVALID",
        },
        { status: 401 },
      )
    }

    const created = await createGoogleUser(
      {
        email: pending.email,
        name: pending.name,
        picture: pending.picture,
        emailVerified: true,
      },
      {
        marketingEmail: parsed.data.marketingEmail,
        marketingWhatsapp: parsed.data.marketingWhatsapp,
        marketingSms: parsed.data.marketingSms,
        noticeVersion: parsed.data.noticeVersion,
      },
      request,
    )

    if (!created.ok) {
      return NextResponse.json(
        { error: created.message, code: created.code },
        { status: created.status },
      )
    }

    const device: DeviceInfo = (body as { device?: DeviceInfo })?.device ?? {}
    const accessToken = await createSessionToken({
      ...buildSessionPayload(created.user),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    })
    const refresh = await issueRefreshToken(created.user.id, device)

    return NextResponse.json(
      {
        tokenType: "Bearer",
        accessToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: refresh.token,
        refreshExpiresAt: refresh.expiresAt.toISOString(),
        user: created.user,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    console.error("[v1/auth/google/complete] error", error)
    return NextResponse.json({ error: "An error occurred during Google sign-in." }, { status: 500 })
  }
}
