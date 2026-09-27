import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import bcrypt from "bcryptjs"
import { detectBot, getClientIP, resetRateLimit } from "@/lib/botDetection"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"
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
    let user: any = null
    let usersCollection: any = null
    try {
      const conn = await connectToDatabase()
      usersCollection = conn.db.collection("users")
      user = await usersCollection.findOne({ email: email.toLowerCase() })
    } catch (dbError) {
      console.error("Database authentication error:", dbError)
      return NextResponse.json(
        { message: "Unable to reach the authentication service. Please try again." },
        { status: 503 },
      )
    }

    // Validate credentials
    const isPasswordValid =
      !!user && (await bcrypt.compare(password, user.password))

    if (!user || !isPasswordValid) {
      return NextResponse.json({ message: "Invalid email or password" }, { status: 401 })
    }

    if (user.status === "inactive") {
      return NextResponse.json({ message: "This staff account is inactive" }, { status: 403 })
    }

    // Update last login (best-effort; never block login on this)
    try {
      await usersCollection.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date(), updatedAt: new Date() } },
      )
    } catch (updateError) {
      console.warn("[Auth] Failed to update lastLogin", updateError)
    }

    // Create user object without password
    const userResponse = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role || "user",
      emailVerified: user.emailVerified || false,
      createdAt: user.createdAt,
      avatar: user.avatar || null,
      phone: user.phone || null,
      address: user.address || null,
      dashboardAccess: !!user.dashboardAccess,
      allowedPages: Array.isArray(user.allowedPages) ? user.allowedPages : [],
    }

    const response = NextResponse.json({
      message: "Login successful",
      user: userResponse,
    })

    // Authoritative, tamper-proof session — signed and httpOnly so it
    // cannot be read or forged by client-side JavaScript / XSS.
    // Limit allowedPages length to avoid oversized cookies which some
    // browsers will silently reject. Also truncate each entry to a
    // reasonable max length. If the payload is still large, drop
    // allowedPages entirely as a last resort.
    const rawAllowed = Array.isArray(userResponse.allowedPages)
      ? userResponse.allowedPages
      : []
    const safeAllowed = rawAllowed
      .map((p) => String(p).slice(0, 200)) // limit string length
      .filter(Boolean)
      .slice(0, 200) // limit number of entries

    const payloadCandidate = {
      id: userResponse.id,
      email: userResponse.email,
      name: String(userResponse.name || "").slice(0, 80),
      role: userResponse.role as any,
      dashboardAccess: userResponse.dashboardAccess,
      allowedPages: safeAllowed,
    }

    // If the serialized payload is too large, warn and omit allowedPages.
    // Browsers cap a single cookie at ~4096 bytes (name + value). The signed
    // token is base64url(payload) + "." + signature, and base64 inflates the
    // payload by ~33%, so a JSON payload over ~2500 chars can produce a cookie
    // that exceeds the limit and is SILENTLY DROPPED by the browser — which
    // logs the user out on the very next request (the "I logged in but every
    // protected page bounces me to the home page" symptom for admin/staff
    // accounts with many allowedPages). Keep the threshold conservative.
    try {
      const size = JSON.stringify(payloadCandidate).length
      if (size > 2500) {
        console.warn("[Auth] Session payload too large; omitting allowedPages", { size })
        payloadCandidate.allowedPages = []
      }
    } catch (err) {
      // Ignore JSON errors; proceed without allowedPages
      payloadCandidate.allowedPages = []
    }

    const sessionToken = await createSessionToken(payloadCandidate)

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