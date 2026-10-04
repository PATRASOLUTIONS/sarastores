import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { ObjectId, type Document } from "mongodb"

interface UserDocument extends Document {
  _id: ObjectId | string
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const userId = request.nextUrl.searchParams.get("userId")
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (!token || !userId) {
    return NextResponse.redirect(`${siteUrl}/verify-email?status=invalid`)
  }

  try {
    const { db } = await connectToDatabase()
    const usersCollection = db.collection<UserDocument>("users")

    let userDoc: any = null
    if (ObjectId.isValid(userId)) {
      userDoc = await usersCollection.findOne({ _id: new ObjectId(userId) })
    }
    if (!userDoc) {
      userDoc = await usersCollection.findOne({ _id: userId })
    }

    if (!userDoc) {
      return NextResponse.redirect(`${siteUrl}/verify-email?status=invalid`)
    }

    if (userDoc.emailVerified === true && userDoc.emailVerificationToken === undefined) {
      return NextResponse.redirect(`${siteUrl}/verify-email?status=already`)
    }

    if (userDoc.emailVerificationToken !== token) {
      return NextResponse.redirect(`${siteUrl}/verify-email?status=invalid`)
    }

    const expiry = userDoc.emailVerificationExpiry
    if (expiry && new Date(expiry) < new Date()) {
      return NextResponse.redirect(`${siteUrl}/verify-email?status=expired`)
    }

    await usersCollection.updateOne(
      { _id: userDoc._id },
      {
        $set: { emailVerified: true, updatedAt: new Date() },
        $unset: { emailVerificationToken: "", emailVerificationExpiry: "" },
      }
    )

    return NextResponse.redirect(`${siteUrl}/verify-email?status=success`)
  } catch (error) {
    console.error("[Verify Email] Error:", error)
    return NextResponse.redirect(`${siteUrl}/verify-email?status=error`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const usersCollection = db.collection<UserDocument>("users")

    let userDoc: any = null
    if (ObjectId.isValid(userId)) {
      userDoc = await usersCollection.findOne({ _id: new ObjectId(userId) })
    }
    if (!userDoc) {
      userDoc = await usersCollection.findOne({ _id: userId })
    }

    if (!userDoc) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (userDoc.emailVerified) {
      return NextResponse.json({ message: "Email already verified" })
    }

    const crypto = await import("crypto")
    const token = crypto.randomBytes(32).toString("hex")
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await usersCollection.updateOne(
      { _id: userDoc._id },
      { $set: { emailVerificationToken: token, emailVerificationExpiry: expiry, updatedAt: new Date() } }
    )

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
    const verifyUrl = `${siteUrl}/api/auth/verify-email?token=${token}&userId=${userDoc._id.toString()}`

    try {
      const { sendEmail } = await import("@/lib/email")
      await sendEmail({
        to: userDoc.email,
        subject: "Verify your email address - Sara Electronics",
        html: `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:30px;text-align:center">
              <h2 style="color:#111827;margin-top:0">Verify Your Email</h2>
              <p style="color:#374151;line-height:1.6">Hi ${userDoc.name || "there"},</p>
              <p style="color:#374151;line-height:1.6">Thanks for signing up! Please verify your email address to activate your account.</p>
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
    } catch (emailErr) {
      console.error("[Verify Email] Failed to send verification email:", emailErr)
      return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 })
    }

    return NextResponse.json({ message: "Verification email sent" })
  } catch (error) {
    console.error("[Verify Email] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
