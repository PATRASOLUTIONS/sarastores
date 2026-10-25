import { NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"
import { getRequestSessionToken } from "@/lib/auth"
import { revokeSessionToken } from "@/lib/session-revocation"

export async function POST() {
  let revocationFailed = false
  try {
    const token = await getRequestSessionToken()
    const payload = await verifySessionToken(token)
    if (token && payload) await revokeSessionToken(token, payload.exp)
  } catch (error) {
    console.error("[Logout] Session revocation failed", error)
    // Do not report successful invalidation when storage is unavailable.
    revocationFailed = true
  }

  const response = revocationFailed
    ? NextResponse.json({ error: "Session invalidation is temporarily unavailable. Please retry logout." }, {
      status: 503, headers: { "Retry-After": "60" },
    })
    : NextResponse.json({ message: "Logged out successfully" })

  try {
    const expire = {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 0,
      path: "/",
    }

    const domainOpt = process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN.replace(/^\./, "") } : {}

    // Clear the authoritative session cookie and the cosmetic user cookie
    response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, ...domainOpt, ...expire })
    response.cookies.set("user", "", { httpOnly: true, ...domainOpt, ...expire })

    return response
  } catch (error) {
    console.error("Logout error:", error)
    return NextResponse.json({ message: "An error occurred during logout" }, { status: 500 })
  }
}
