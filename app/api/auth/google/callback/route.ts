import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/auth/google/callback`

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  expires_in: number
  token_type: string
  scope: string
}

interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name: string
  given_name: string
  family_name: string
  picture: string
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google token exchange failed: ${err}`)
  }

  return res.json()
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error("Failed to fetch Google user info")
  }

  return res.json()
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state") || "/"
  const error = request.nextUrl.searchParams.get("error")

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (error) {
    return NextResponse.redirect(`${siteUrl}/login?error=google_auth_cancelled`)
  }

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/login?error=google_auth_failed`)
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${siteUrl}/login?error=google_not_configured`)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    const googleUser = await fetchGoogleUserInfo(tokens.access_token)

    if (!googleUser.email) {
      return NextResponse.redirect(`${siteUrl}/login?error=google_no_email`)
    }

    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    let user = await usersCollection.findOne({ email: googleUser.email.toLowerCase() })

    if (!user) {
      const newUser = {
        name: googleUser.name || `${googleUser.given_name || ""} ${googleUser.family_name || ""}`.trim() || "Google User",
        email: googleUser.email.toLowerCase(),
        password: null,
        role: "user",
        emailVerified: true,
        avatar: googleUser.picture || null,
        authProvider: "google",
        createdAt: new Date(),
        updatedAt: new Date(),
        cart: [],
        wishlist: [],
        orders: [],
      }

      const result = await usersCollection.insertOne(newUser)
      user = { ...newUser, _id: result.insertedId }
    } else if (!user.authProvider) {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { authProvider: "google", emailVerified: true, updatedAt: new Date() } }
      )
      user.authProvider = "google"
      user.emailVerified = true
    }

    const userId = user._id.toString()
    const userRole = user.role || "user"
    const dashboardAccess = !!user.dashboardAccess
    const allowedPages = Array.isArray(user.allowedPages) ? user.allowedPages : []

    const sessionToken = await createSessionToken({
      id: userId,
      email: user.email,
      name: String(user.name || "").slice(0, 80),
      role: userRole as any,
      dashboardAccess,
      allowedPages: allowedPages.map((p: string) => String(p).slice(0, 200)).filter(Boolean).slice(0, 200),
    })

    const response = NextResponse.redirect(`${siteUrl}${state.startsWith("/") ? state : "/"}`)

    const isProd = process.env.NODE_ENV === "production"
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    })

    const minimalUser = { id: userId, email: user.email, role: userRole }
    response.cookies.set("user", encodeURIComponent(JSON.stringify(minimalUser)), {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
    })

    return response
  } catch (err) {
    console.error("[Google OAuth] Error:", err)
    return NextResponse.redirect(`${siteUrl}/login?error=google_auth_error`)
  }
}
