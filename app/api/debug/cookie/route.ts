import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  try {
    const cookieHeader = request.headers.get("cookie") || null
    const sessionToken = request.cookies.get(SESSION_COOKIE)?.value
    const verified = sessionToken ? await verifySessionToken(sessionToken) : null

    return NextResponse.json({
      cookieHeader,
      sessionToken: sessionToken ?? null,
      verified,
    })
  } catch (error) {
    console.error("/api/debug/cookie error:", error)
    return NextResponse.json({ message: "Debug endpoint error" }, { status: 500 })
  }
}
