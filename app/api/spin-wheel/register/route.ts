import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { getCampaignCollection } from "@/lib/spin-wheel-campaigns"

export const maxDuration = 15 // Allow 15s for Vercel serverless

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, store, verificationToken, senderNumber, campaignId } = body
    const campaignSlug = campaignId || "default"

    // Validation
    if (!name || !phone || !email) {
      return NextResponse.json(
        { error: "Name, phone, and email are required" },
        { status: 400 }
      )
    }

    if (!verificationToken) {
      return NextResponse.json(
        { error: "OTP verification is required before registration" },
        { status: 400 }
      )
    }

    // Validate phone format (Indian)
    const cleanPhone = phone.replace(/\D/g, "").slice(-10)
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit phone number" },
        { status: 400 }
      )
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      )
    }

    const { db } = await connectToDatabase()
    const participantsCol = await getCampaignCollection(campaignSlug, "participants")
    const otpCol = await getCampaignCollection(campaignSlug, "otps")

    // Verify OTP token
    const otpRecord = await otpCol.findOne({
      phone: cleanPhone,
      verificationToken,
      verified: true
    })

    if (!otpRecord) {
      return NextResponse.json(
        { error: "Invalid or expired verification. Please verify OTP again." },
        { status: 403 }
      )
    }

    // Check for duplicate: same phone OR same email
    const existing = await participantsCol.findOne({
      $or: [
        { phone: cleanPhone },
        { email: email.trim().toLowerCase() }
      ]
    })

    if (existing) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: "You have already participated. You cannot spin again."
        },
        { status: 409 }
      )
    }

    // Create participant
    const participant = {
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim().toLowerCase(),
      store: store || "direct",
      senderNumber: senderNumber || null, // Store sender number for later win notification
      otpCode: otpRecord.otp,
      otpVerified: true,
      otpVerifiedAt: otpRecord.verifiedAt || new Date(),
      hasSpun: false,
      prize: null,
      couponCode: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    const result = await participantsCol.insertOne(participant)

    // Clean up OTP record
    await otpCol.deleteOne({ phone: cleanPhone })

    return NextResponse.json({
      success: true,
      participantId: result.insertedId.toString(),
      message: "Registration successful! You can now spin the wheel."
    })
  } catch (error: any) {
    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        {
          error: "duplicate",
          message: "You have already participated. You cannot spin again."
        },
        { status: 409 }
      )
    }
    console.error("Spin wheel registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
