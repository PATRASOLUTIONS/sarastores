import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/google/callback`

export async function GET(request: NextRequest) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ error: "Google login is not configured" }, { status: 503 })
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID)
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "openid email profile")
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("prompt", "consent")

  const redirectTo = request.nextUrl.searchParams.get("redirect")
  if (redirectTo && redirectTo.startsWith("/")) {
    url.searchParams.set("state", redirectTo)
  }

  return NextResponse.redirect(url.toString())
}
