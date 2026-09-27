/**
 * POST /api/v1/auth/login — native (mobile) login.
 *
 * Returns a short-lived bearer access token plus a long-lived refresh token,
 * instead of the httpOnly cookie the web app uses. A native client cannot hold
 * an httpOnly cookie, and the 24 h access token alone would sign users out
 * daily.
 */

import { NextRequest, NextResponse } from "next/server"
import { detectBot, getClientIP, resetRateLimit } from "@/lib/botDetection"
import { buildSessionPayload, verifyCredentials } from "@/lib/auth-credentials"
import { createSessionToken } from "@/lib/session"
import { ACCESS_TOKEN_TTL_SECONDS, issueRefreshToken, type DeviceInfo } from "@/lib/refresh-tokens"
import { LoginSchema } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const botCheck = await detectBot(request, body)
    if (botCheck.isBot) {
      console.warn("[v1/auth/login] bot detected", { reason: botCheck.reason, ip: getClientIP(request) })
      return NextResponse.json(
        {
          error: botCheck.waitTime
            ? `Too many login attempts. Try again in ${Math.ceil(botCheck.waitTime / 60)} minutes.`
            : "Request validation failed.",
        },
        { status: 429 },
      )
    }

    const signingSecret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ""
    if (!signingSecret || signingSecret.length < 16) {
      console.error("[v1/auth/login] SESSION_SECRET/NEXTAUTH_SECRET missing or too short")
      return NextResponse.json({ error: "Server is not configured correctly." }, { status: 500 })
    }

    const { email, password } = parsed.data
    const credentials = await verifyCredentials(email, password)
    if (!credentials.ok) {
      return NextResponse.json({ error: credentials.message }, { status: credentials.status })
    }

    const user = credentials.user
    const device: DeviceInfo = body.device ?? {}

    const accessToken = await createSessionToken({
      ...buildSessionPayload(user),
      exp: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS,
    })
    const refresh = await issueRefreshToken(user.id, device)

    await resetRateLimit(getClientIP(request))

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
    console.error("[v1/auth/login] error", error)
    return NextResponse.json({ error: "An error occurred during login." }, { status: 500 })
  }
}
