import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import bcrypt from "bcryptjs"
import { detectBot, formatWait, getClientIP, resetRateLimit } from "@/lib/botDetection"
import crypto from "crypto"
import { RegisterSchema } from "@/lib/validation"
import { recordConsent, CONSENT_PURPOSES, type ConsentDecision } from "@/lib/consent"
import { defaultProfileAvatar } from "@/lib/profile-avatars"
import { handleApiError, RateLimitUnavailableError } from "@/lib/api-error"
import { RecaptchaConfigurationError } from "@/lib/recaptcha-config"

// Use dynamic import for email functions to prevent build-time issues
const getEmailFunctions = async () => {
  const emailModule = await import("@/lib/email")
  return {
    sendEmail: emailModule.sendEmail,
    getRegistrationEmailTemplate: emailModule.getRegistrationEmailTemplate,
  }
}

/**
 * The single response this endpoint gives for any well-formed submission,
 * whether or not the address already has an account. It must stay identical in
 * both branches — a difference in status, body or field set re-opens the
 * enumeration oracle. The client never reads a user object from signup
 * (AuthContext deliberately does not auto-login), so omitting one costs
 * nothing.
 */
const GENERIC_SIGNUP_RESPONSE = {
  message: "Thanks. If that email address can be registered, we have sent a link to confirm it.",
  success: true,
} as const

/**
 * Tell the real account holder that someone tried to sign up with their
 * address. This is the only place the "account exists" fact is disclosed, and
 * it goes to the person entitled to know it rather than to the form.
 */
async function notifyExistingAccount(email: string): Promise<void> {
  try {
    const { sendEmail } = await getEmailFunctions()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    await sendEmail({
      to: email,
      subject: "Someone tried to create an account with your email",
      preheader: "No action is needed unless this was you.",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:30px">
            <h2 style="color:#111827;margin-top:0">You already have an account</h2>
            <p style="color:#374151;line-height:1.6">
              Someone just tried to register a new Sara Electronics account using this email address.
              You already have one, so nothing has changed and no new account was created.
            </p>
            <p style="color:#374151;line-height:1.6">
              If this was you, sign in instead &mdash; or reset your password if you have forgotten it.
            </p>
            <p style="margin:30px 0">
              <a href="${siteUrl}/login" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;font-size:16px">Sign in</a>
            </p>
            <p style="color:#6b7280;font-size:13px">
              If this was not you, you can safely ignore this email. Your account and password are unchanged.
            </p>
          </div>
        </body>
        </html>
      `,
    })
  } catch (error) {
    // Never let a mail failure change the response shape — that would restore
    // the very distinction this branch exists to remove.
    console.error("Failed to send existing-account notice:", error)
  }
}

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
      return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 })
    }
    const {
      email,
      password,
      name,
      marketingEmail,
      marketingWhatsapp,
      marketingSms,
      noticeVersion,
    } = parsed.data

    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    /*
     * An existing address must not be distinguishable from a new one.
     *
     * Returning 409 "User with this email already exists" turned this endpoint
     * into a membership oracle for any address an attacker cared to try. The
     * response below is byte-identical to the success response, and the real
     * account holder — not the person submitting the form — is told that
     * someone tried to register with their address.
     */
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      // Spend the same work the real path spends, so response time does not
      // leak what the response body refuses to.
      await bcrypt.hash(password, 12)
      await notifyExistingAccount(String(existingUser.email))
      return NextResponse.json(GENERIC_SIGNUP_RESPONSE)
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex")
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create new user
    const newUser = {
      name: name.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user",
      avatar: defaultProfileAvatar(email.toLowerCase()),
      emailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: verificationExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
      cart: [],
      wishlist: [],
      orders: [],
    }

    const result = await usersCollection.insertOne(newUser)
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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
      const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${verificationToken}&userId=${result.insertedId.toString()}`

      await sendEmail({
        to: email,
        subject: "Verify your email address - Sara Electronics",
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:30px;text-align:center">
              <h2 style="color:#111827;margin-top:0">Welcome to Sara Electronics!</h2>
              <p style="color:#374151;line-height:1.6">Hi ${name.trim()},</p>
              <p style="color:#374151;line-height:1.6">Thanks for creating your account. Please verify your email address to get started.</p>
              <p style="margin:30px 0">
                <a href="${verifyUrl}" style="background:#2563eb;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;font-size:16px">
                  Verify Email Address
                </a>
              </p>
              <p style="color:#6b7280;font-size:13px">This link expires in 24 hours.</p>
              <p style="color:#6b7280;font-size:13px">If you didn't create an account, you can safely ignore this email.</p>
            </div>
          </body>
          </html>
        `,
      })
      if (process.env.NODE_ENV === "development") console.log("Verification email sent to:", email)
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError)
      // Don't fail the registration if email fails
    }

    // Identical to the existing-account branch above, deliberately. Anything
    // returned here that is not returned there re-identifies the address.
    return NextResponse.json(GENERIC_SIGNUP_RESPONSE)
  } catch (error) {
    if (error instanceof RateLimitUnavailableError || error instanceof RecaptchaConfigurationError) return handleApiError(error)
    console.error("Signup error:", error)
    return NextResponse.json({
      message: "An error occurred during signup. Please try again.",
      success: false
    }, { status: 500 })
  }
}
