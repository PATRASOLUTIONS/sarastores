import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // Disabled unless explicitly turned on in the environment for safety
  if (process.env.ENABLE_DEBUG_ROUTES !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const session = await getSession()
    const cookieHeader = request.headers.get("cookie") || null

    // Raw cookies are never exposed in production, whatever the flag says.
    const includeRaw =
      process.env.DEBUG_SHOW_COOKIE === "true" && process.env.NODE_ENV !== "production"

    return NextResponse.json({
      hasSession: !!session,
      sessionUserId: session?.user?.id || null,
      cookieHeaderPresent: !!cookieHeader,
      cookieHeader: includeRaw ? cookieHeader : (cookieHeader ? "<present>" : null),
    })
  } catch (err) {
    console.error("/api/debug/session error:", err)
    return NextResponse.json({ error: "Debug check failed" }, { status: 500 })
  }
}
