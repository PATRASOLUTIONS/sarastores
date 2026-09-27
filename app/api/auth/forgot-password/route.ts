import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import crypto from "crypto"
import nodemailer from "nodemailer"
import { withRateLimit } from "@/lib/rate-limit"

export const POST = withRateLimit(async (req: Request) => {
  try {
    const { email } = await req.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
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

    // Create reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`

    // Send email
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <title>Reset Your Password</title>
  <style>
    :root {
      color-scheme: light only;
      supported-color-schemes: light;
    }
    body {
      color-scheme: light only !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">Password Reset Request</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                Hello,
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 24px; color: #333333;">
                We received a request to reset your password for your account. If you didn't make this request, you can safely ignore this email.
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 24px; color: #333333;">
                To reset your password, click the button below:
              </p>
              
              <!-- Button -->
              <table role="presentation" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 4px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 30px 0 20px 0; font-size: 14px; line-height: 20px; color: #666666;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 30px 0; font-size: 14px; line-height: 20px; color: #667eea; word-break: break-all;">
                ${resetUrl}
              </p>
              
              <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; line-height: 20px; color: #856404;">
                  <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour for your security.
                </p>
              </div>
              
              <p style="margin: 0 0 10px 0; font-size: 14px; line-height: 20px; color: #666666;">
                If you didn't request a password reset, please ignore this email or contact support if you have concerns.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 10px 0; font-size: 12px; line-height: 18px; color: #999999; text-align: center;">
                This is an automated email. Please do not reply to this message.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #999999; text-align: center;">
                © ${new Date().getFullYear()} ByteWise. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `

    await transporter.sendMail({
      from: `"Sara Support" <${process.env.EMAIL_FROM}>`,
      to: user.email,
      subject: "Reset Your Password - ByteWise",
      html: emailHtml,
    })

    return NextResponse.json({
      ok: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    })
  } catch (error: any) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Failed to process password reset request. Please try again later." },
      { status: 500 }
    )
  }
}, { maxRequests: 3, windowMs: 60000 })
