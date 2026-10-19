import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { randomBytes } from "crypto"
import { getCampaignCollection, resolveCampaignSlug } from "@/lib/spin-wheel-campaigns"

export const maxDuration = 15 // Allow 15s for Vercel serverless

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, phone, email, store, verificationToken, senderNumber, campaignId } = body
    const campaignSlug = resolveCampaignSlug(campaignId)
    if (!campaignSlug) {
      return NextResponse.json({ error: "Invalid campaign" }, { status: 400 })
    }

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

    /*
     * The spin token is what proves, at spin time, that the caller is the
     * person who completed OTP verification. The OTP record is deleted below,
     * so without this the spin endpoint has nothing left to check and any
     * party holding a participant id could consume that person's single spin
     * and claim their coupon. ObjectIds embed a timestamp and a counter, so
     * they are only semi-unguessable and are not a credential.
     */
    const spinToken = randomBytes(24).toString("base64url")

    // Create participant. The free-text fields are capped because they are
    // stored verbatim and nothing upstream bounds their length.
    const participant = {
      name: String(name).trim().slice(0, 120),
      phone: cleanPhone,
      email: email.trim().toLowerCase(),
      store: String(store || "direct").trim().slice(0, 120),
      // Store sender number for later win notification.
      senderNumber: senderNumber ? String(senderNumber).trim().slice(0, 20) : null,
      otpCode: otpRecord.otp,
      otpVerified: true,
      otpVerifiedAt: otpRecord.verifiedAt || new Date(),
      spinToken,
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
      spinToken,
      message: "Registration successful! You can now spin the wheel."
    })
  } catch (error) {
    // Handle MongoDB duplicate key error
    if (error !== null && typeof error === "object" && "code" in error && error.code === 11000) {
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
