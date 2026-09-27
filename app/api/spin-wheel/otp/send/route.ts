import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { sendOtpEmail, sendWhatsAppOTP } from "@/lib/spin-wheel-notifications"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"

export const maxDuration = 15 // Allow 15s for Vercel serverless

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, email, name, senderNumber, campaignId } = body
    const campaignSlug = campaignId || "default"

    if (!phone || !email || !name) {
      return NextResponse.json(
        { error: "Phone, email, and name are required" },
        { status: 400 }
      )
    }

    // Validate phone
    const cleanPhone = phone.replace(/\D/g, "").slice(-10)
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit phone number" },
        { status: 400 }
      )
    }

    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const otpCol = await getCampaignCollection(campaignSlug, "otps")
    const participantsCol = await getCampaignCollection(campaignSlug, "participants")

    // Check if user already participated
    const existingParticipant = await participantsCol.findOne({
      $or: [
        { phone: cleanPhone },
        { email: email.trim().toLowerCase() }
      ]
    })

    if (existingParticipant) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: "You have already participated. You cannot spin again."
        },
        { status: 409 }
      )
    }

    // Rate limit: max 3 OTP requests per phone in 15 minutes
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
    const recentAttempts = await otpCol.countDocuments({
      phone: cleanPhone,
      createdAt: { $gte: fifteenMinAgo }
    })

    if (recentAttempts >= 3) {
      return NextResponse.json(
        { error: "Too many OTP requests. Please try again after some time." },
        { status: 429 }
      )
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 min expiry

    // Store OTP
    await otpCol.updateOne(
      { phone: cleanPhone },
      {
        $set: {
          otp,
          email: email.trim().toLowerCase(),
          name: name.trim(),
          expiresAt,
          verified: false,
          attempts: 0,
          createdAt: new Date()
        }
      },
      { upsert: true }
    )

    // Send notifications concurrently and await them to ensure process doesn't exit prematurely
    await Promise.allSettled([
      sendOtpEmail(email.trim(), name.trim(), otp)
        .catch((err: unknown) => console.error("OTP email failed:", err)),
      sendWhatsAppOTP(cleanPhone, otp, senderNumber)
        .catch((err: unknown) => console.error("WhatsApp OTP failed:", err))
    ])

    return NextResponse.json({
      success: true,
      message: "OTP sent to your phone and email.",
      expiresIn: 300 // 5 min in seconds
    })
  } catch (error) {
    console.error("OTP send error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
