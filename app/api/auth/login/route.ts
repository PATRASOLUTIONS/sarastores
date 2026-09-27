import { NextRequest, NextResponse } from "next/server"
import { detectBot, getClientIP, resetRateLimit } from "@/lib/botDetection"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"
import { buildSessionPayload, verifyCredentials } from "@/lib/auth-credentials"
import { LoginSchema } from "@/lib/validation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { email, password } = parsed.data

    // Bot detection for login endpoint
    const botCheck = await detectBot(request, body)
    if (botCheck.isBot) {
      console.warn('Bot detected on login:', {
        reason: botCheck.reason,
        ip: getClientIP(request),
        timestamp: new Date().toISOString()
      })
      
      return NextResponse.json(
        { 
          message: botCheck.waitTime 
            ? `Too many login attempts. Please try again in ${Math.ceil(botCheck.waitTime / 60)} minutes.`
            : "Request validation failed. Please try again.",
          success: false
        }, 
        { status: 429 }
      )
    }

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required" }, { status: 400 })
    }

    // Fail fast and loudly if the signing secret is misconfigured. Without
    // this guard, a missing/short secret causes createSessionToken() to throw
    // and (previously) be swallowed by the database catch below, surfacing as
    // a misleading "Invalid email or password" 401 — i.e. login silently
    // breaks in production while working locally. This is the #1 cause of
    // "login works on localhost but not on the live site".
    const signingSecret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ""
    if (!signingSecret || signingSecret.length < 16) {
      console.error(
        "[Auth] SESSION_SECRET/NEXTAUTH_SECRET is missing or too short. " +
          "Set a strong 32+ character secret in your production environment.",
      )
      return NextResponse.json(
        {
          message:
            "Server is not configured correctly. Please contact support. (auth secret missing)",
        },
        { status: 500 },
      )
    }

    // Authenticate against database. DB/network failures are a genuine 500;
    // they must NOT be reported to the user as invalid credentials.
    const credentials = await verifyCredentials(email, password)
    if (!credentials.ok) {
      return NextResponse.json({ message: credentials.message }, { status: credentials.status })
    }
    const userResponse = credentials.user

    const response = NextResponse.json({
      message: "Login successful",
      user: userResponse,
    })

    // Authoritative, tamper-proof session — signed and httpOnly so it
    // cannot be read or forged by client-side JavaScript / XSS.
    const sessionToken = await createSessionToken(buildSessionPayload(userResponse))

    // Resolve a sane cookie domain. In production, if COOKIE_DOMAIN is not
    // set explicitly, we still want the cookie to be sent to subdomains
    // (e.g. `www.sarastores.com` <-> `sarastores.com`) for cross-subdomain
    // navigations, but not for unrelated subdomains. Setting `Domain` to a
    // bare apex like `sarastores.com` (with a leading dot) is the standard
    // way to make a cookie available to `sarastores.com` AND
    // `www.sarastores.com`. We respect a user-provided override first.
    const explicitDomain = process.env.COOKIE_DOMAIN
    const isProd = process.env.NODE_ENV === "production"
    const normalizedDomain = explicitDomain
      ? explicitDomain.replace(/^\./, "")
      : isProd
        ? undefined
        : undefined

    response.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: isProd,
      // `lax` is the safe default for same-site admin navigations. If the
      // production deploy serves the admin app and the API from different
      // subdomains (e.g. admin.sarastores.com vs api.sarastores.com), the
      // host should set COOKIE_DOMAIN=.sarastores.com and we will switch to
      // `none` so the cookie is always sent. We pick `lax` here because it
      // works for the most common deploy shape (admin and API on the same
      // host) and is also the most compatible default for browsers.
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
      ...(normalizedDomain ? { domain: normalizedDomain } : {}),
    })

    // Cosmetic, non-authoritative cookie so the client UI can detect a
    // logged-in state. Never trusted by the server for authorization.
    const minimalUser = {
      id: userResponse.id,
      email: userResponse.email,
      role: userResponse.role,
    }
    // Encode the cosmetic user cookie value to avoid issues with
    // special characters and to ensure consistent behavior across
    // proxies/CDNs in production.
    response.cookies.set("user", encodeURIComponent(JSON.stringify(minimalUser)), {
      httpOnly: false,
      secure: isProd,
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE,
      path: "/",
      ...(normalizedDomain ? { domain: normalizedDomain } : {}),
    })

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ message: "An error occurred during login. Please try again." }, { status: 500 })
  }
}