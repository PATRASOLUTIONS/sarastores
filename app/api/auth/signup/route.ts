import { NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import bcrypt from "bcryptjs"
import { detectBot, formatWait, getClientIP, resetRateLimit } from "@/lib/botDetection"
import crypto from "crypto"
import { RegisterSchema } from "@/lib/validation"
import { recordConsent, CONSENT_PURPOSES, type ConsentDecision } from "@/lib/consent"
import { defaultProfileAvatar } from "@/lib/profile-avatars"
import { handleApiError, RateLimitUnavailableError } from "@/lib/api-error"
import { RecaptchaConfigurationError } from "@/lib/recaptcha-config"
import { ACCOUNT_EMAIL_COLLATION, ensureAccountEmailIndex, isDuplicateAccountEmail } from "@/lib/account-email-index"
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session"
import { buildVerificationEmail, verificationUrl } from "@/lib/verification-email"

// Use dynamic import for email functions to prevent build-time issues
const getEmailFunctions = async () => {
  const emailModule = await import("@/lib/email")
  return {
    sendEmail: emailModule.sendEmail,
    getRegistrationEmailTemplate: emailModule.getRegistrationEmailTemplate,
  }
}

// Clients requesting a cookie session also receive a safe account summary.
const SIGNUP_RESPONSE = {
  message: "Thanks. We have sent a link to confirm your email address.",
  success: true,
} as const

const EMAIL_EXISTS_MESSAGE = "An account with this email already exists."

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Bot detection - CRITICAL SECURITY CHECK.
    //
    // The per-IP counter must stay on: reCAPTCHA is the only other control and
    // it is disabled whenever RECAPTCHA_ENABLED is not "true", which would
    // leave account creation completely unthrottled.
    const botCheck = await detectBot(request, body, { requireRecaptcha: true })
    if (botCheck.isBot) {
      console.warn('Bot detected:', {
        reason: botCheck.reason,
        ip: getClientIP(request),
        timestamp: new Date().toISOString()
      })

      // Return a generic error to avoid information leakage
      return NextResponse.json(
        {
          message: botCheck.waitTime
            ? `Too many attempts. Please try again in ${formatWait(botCheck.waitTime)}.`
            : "Request validation failed. Please try again.",
          success: false
        },
        { status: 429 }
      )
    }

    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0])
        if (!fieldErrors[field]) fieldErrors[field] = issue.message
      }
      return NextResponse.json({ message: parsed.error.errors[0].message, fieldErrors }, { status: 400 })
    }
    const {
      email,
      password,
      name,
      startSession,
      marketingEmail,
      marketingWhatsapp,
      marketingSms,
      noticeVersion,
    } = parsed.data

    if (startSession) {
      const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ""
      if (secret.length < 16) {
        return NextResponse.json({ message: "Account registration is temporarily unavailable. Please try again later." }, { status: 503 })
      }
    }

    const usersCollection = await getCollection("users")
    try {
      // Idempotent, and safe when several instances register concurrently.
      // Existing conflicting legacy records/indexes must be reconciled by an
      // operator; never accept an unprotected insert if index creation fails.
      await ensureAccountEmailIndex(usersCollection)
    } catch {
      console.error("[Signup] Account email uniqueness index is unavailable")
      return NextResponse.json({ message: "Account creation is temporarily unavailable. Please try again later.", success: false }, {
        status: 503, headers: { "Retry-After": "60" },
      })
    }

    // Disclosing an existing address is a product decision; the per-IP
    // counter and reCAPTCHA in detectBot above are what bound enumeration.
    const existingUser = await usersCollection.findOne({ email }, { collation: ACCOUNT_EMAIL_COLLATION })
    if (existingUser) {
      return NextResponse.json(
        { message: EMAIL_EXISTS_MESSAGE, code: "EMAIL_EXISTS", success: false },
        { status: 409 },
      )
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex")
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create new user
    const newUser = {
      name,
      email,
      password: hashedPassword,
      role: "user",
      avatar: defaultProfileAvatar(email),
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
      cart: [],
      wishlist: [],
      orders: [],
    }

    let result
    try {
      result = await usersCollection.insertOne(newUser)
    } catch (error) {
      if (!isDuplicateAccountEmail(error)) throw error
      return NextResponse.json({ message: EMAIL_EXISTS_MESSAGE, code: "EMAIL_EXISTS", success: false }, { status: 409 })
    }
    const newUserId = result.insertedId.toString()

    /**
     * Consent ledger (DPDP Sections 6 and 8(4)). The account purpose is
     * necessary to provide the service; the marketing purposes are recorded
     * individually, including the negatives, because proving someone declined
     * matters as much as proving they agreed.
     */
    const decisions: ConsentDecision[] = [
      { purpose: CONSENT_PURPOSES.ACCOUNT, granted: true },
      { purpose: CONSENT_PURPOSES.MARKETING_EMAIL, granted: Boolean(marketingEmail) },
      { purpose: CONSENT_PURPOSES.MARKETING_WHATSAPP, granted: Boolean(marketingWhatsapp) },
      { purpose: CONSENT_PURPOSES.MARKETING_SMS, granted: Boolean(marketingSms) },
    ]
    await recordConsent({
      userId: newUserId,
      decisions,
      source: "signup",
      request,
      noticeVersion,
    })

    // Mirror the marketing choices onto the profile the campaign jobs read.
    if (marketingEmail || marketingWhatsapp || marketingSms) {
      try {
        const { setConsent } = await import("@/lib/customer-profile")
        await setConsent(
          newUserId,
          {
            email: Boolean(marketingEmail),
            whatsapp: Boolean(marketingWhatsapp),
            sms: Boolean(marketingSms),
          },
          "signup",
        )
      } catch (consentError) {
        console.error("Failed to seed marketing consent profile:", consentError)
      }
    }

    // Reset rate limit on successful signup
    const clientIP = getClientIP(request)
    await resetRateLimit(clientIP)

    // Send verification email - wrapped in try/catch to prevent build errors
    try {
      const { sendEmail } = await getEmailFunctions()
      const verifyUrl = verificationUrl(verificationToken, result.insertedId.toString())

      await sendEmail({
        to: email,
        subject: "Verify your email address - Sara Electronics",
        ...buildVerificationEmail(name, verifyUrl),
      })
      if (process.env.NODE_ENV === "development") console.log("Verification email sent to:", email)
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      // Don't fail the registration if email fails
    }

    if (!startSession) return NextResponse.json(SIGNUP_RESPONSE)

    const user = {
      id: newUserId, name, email, role: "user" as const,
      avatar: newUser.avatar, emailVerified: false, createdAt: newUser.createdAt,
      dashboardAccess: false, allowedPages: [], sessionVersion: 0,
    }
    const sessionToken = await createSessionToken({
      id: user.id, name: user.name, email: user.email, role: user.role,
      dashboardAccess: false, allowedPages: [], sessionVersion: 0,
    })
    const response = NextResponse.json({ ...SIGNUP_RESPONSE, user }, {
      headers: { "Cache-Control": "private, no-store" },
    })
    const cookieOptions = {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const, maxAge: SESSION_MAX_AGE, path: "/",
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN.replace(/^\./, "") } : {}),
    }
    response.cookies.set(SESSION_COOKIE, sessionToken, cookieOptions)
    response.cookies.set("user", encodeURIComponent(JSON.stringify({
      id: user.id, email: user.email, role: user.role,
    })), cookieOptions)
    return response
  } catch (error) {
    if (error instanceof RateLimitUnavailableError || error instanceof RecaptchaConfigurationError) return handleApiError(error)
    console.error("Signup error:", error)
    return NextResponse.json({
      message: "An error occurred during signup. Please try again.",
      success: false
    }, { status: 500 })
  }
}
