/**
 * POST /api/auth/google/complete — finish a Google sign-up on the web.
 *
 * The OAuth callback deliberately does not create an account for an unknown
 * Google identity: the privacy notice and terms must be accepted first. The
 * callback parks the verified identity in a signed token and sends the shopper
 * to `/register/complete`, which posts here.
 *
 * The identity is read from the signed token, never from the request body.
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createGoogleUser } from "@/lib/auth-google"
import { verifyPendingSignupToken } from "@/lib/pending-signup"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"

export const dynamic = "force-dynamic"

const CompleteSchema = z.object({
  token: z.string().min(1, "Missing sign-up token"),
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
        { message: parsed.error.issues[0]?.message ?? "Invalid request", success: false },
        { status: 400 },
      )
    }

    const pending = verifyPendingSignupToken(parsed.data.token)
    if (!pending) {
      return NextResponse.json(
        {
          message: "Your sign-up link expired. Please sign in with Google again.",
          code: "ONBOARDING_TOKEN_INVALID",
          success: false,
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
        { message: created.message, code: created.code, success: false },
        { status: created.status },
      )
    }

    const sessionToken = await createSessionToken({
      id: created.user.id,
      email: created.user.email,
      name: String(created.user.name || "").slice(0, 80),
      role: (created.user.role || "user") as any,
      dashboardAccess: !!created.user.dashboardAccess,
      allowedPages: [],
    })

    const response = NextResponse.json({
      success: true,
      user: { id: created.user.id, name: created.user.name, email: created.user.email },
    })

    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("[auth/google/complete] error", error)
    return NextResponse.json(
      { message: "An error occurred while finishing sign-up.", success: false },
      { status: 500 },
    )
  }
}
