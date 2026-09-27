import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import bcrypt from "bcryptjs"
import { detectBot, getClientIP, resetRateLimit } from "@/lib/botDetection"
import crypto from "crypto"
import { RegisterSchema } from "@/lib/validation"

// Use dynamic import for email functions to prevent build-time issues
const getEmailFunctions = async () => {
  const emailModule = await import("@/lib/email")
  return {
    sendEmail: emailModule.sendEmail,
    getRegistrationEmailTemplate: emailModule.getRegistrationEmailTemplate,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { website, formTimestamp, recaptchaToken } = body

    // Bot detection - CRITICAL SECURITY CHECK
    const botCheck = await detectBot(request, body)
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
            ? `Too many attempts. Please try again in ${Math.ceil(botCheck.waitTime / 60)} minutes.`
            : "Request validation failed. Please try again.",
          success: false
        },
        { status: 429 }
      )
    }

    // Verify reCAPTCHA token if provided
    if (recaptchaToken && process.env.RECAPTCHA_SECRET_KEY) {
      const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        return NextResponse.json({ error: 'reCAPTCHA verification failed' }, { status: 400 });
      }
    }

    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.errors[0].message }, { status: 400 })
    }
    const { email, password, name } = parsed.data

    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    // Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 409 })
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

    // Create user object without password
    const userResponse = {
      id: result.insertedId.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      emailVerified: newUser.emailVerified,
      createdAt: newUser.createdAt,
    }

    return NextResponse.json({
      message: "User created successfully. Please check your email to verify your account.",
      user: userResponse,
      success: true
    })
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json({
      message: "An error occurred during signup. Please try again.",
      success: false
    }, { status: 500 })
  }
}
