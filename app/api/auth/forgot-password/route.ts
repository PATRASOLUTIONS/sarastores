import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"
import { withRateLimit } from "@/lib/rate-limit"
import { buildPasswordResetEmail, sendEmail, storefrontOrigin } from "@/lib/email"
import { ForgotPasswordSchema } from "@/lib/validation"
import { EmailConfigurationError, verifyEmailTransport } from "@/lib/smtp"

export const maxDuration = 60

export const POST = withRateLimit(async (req: Request) => {
  try {
    const parsed = ForgotPasswordSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const { email } = parsed.data

    // Report mail-service outages consistently for registered and unknown
    // addresses. Never reveal account existence through a delivery error.
    try {
      await verifyEmailTransport()
    } catch (error) {
      console.error("[forgot-password] email service unavailable", error instanceof EmailConfigurationError ? error.message : {
        type: error instanceof Error ? error.name : "UnknownError",
        code: error && typeof error === "object" && "code" in error ? error.code : undefined,
      })
      return NextResponse.json({ error: "Password-reset email is temporarily unavailable. Please try again later or contact support.", code: "RESET_EMAIL_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "no-store" } })
    }

    const { db } = await connectToDatabase()
    const usersCollection = db.collection("users")

    // Find user by email (case insensitive)
    const user = await usersCollection.findOne({ email: email.toLowerCase() })

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        ok: true,
        message: "If an account exists with this email, you will receive a password reset link.",
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Save reset token to database
    await usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          resetPasswordToken: resetTokenHash,
          resetPasswordExpiry: resetTokenExpiry,
        },
      }
    )

    const resetUrl = `${storefrontOrigin()}/reset-password?token=${encodeURIComponent(resetToken)}`
    const sent = await sendEmail({
      to: user.email,
      subject: "Reset your Sara Stores password",
      html: buildPasswordResetEmail(resetUrl),
    })
    if (!sent.success) {
      /*
       * Still answer with the generic 200. An unknown address always gets 200,
       * so returning 500 here would confirm that the address *does* have an
       * account whenever mail delivery is failing. The reset token is already
       * stored, so a retry once SMTP recovers will work.
       *
       * A timing difference remains — the known-address path does a database
       * write and an SMTP round trip — which would need a background queue to
       * close properly.
       */
      console.error("[forgot-password] reset mail failed to send; responding generically")
    }

    return NextResponse.json({
      ok: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Failed to process password reset request. Please try again later." },
      { status: 500 }
    )
  }
}, { maxRequests: 3, windowMs: 60000 })
