import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { connectToDatabase } from "@/lib/mongodb"
import { getCampaignCollection, resolveCampaignSlug } from "@/lib/spin-wheel-campaigns"

export const maxDuration = 15 // Allow 15s for Vercel serverless

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, otp, campaignId } = body
    const campaignSlug = resolveCampaignSlug(campaignId)
    if (!campaignSlug) {
      return NextResponse.json({ error: "Invalid campaign" }, { status: 400 })
    }

    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Phone and OTP are required" },
        { status: 400 }
      )
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10)

    const { db } = await connectToDatabase()
    const otpCol = await getCampaignCollection(campaignSlug, "otps")

    const otpRecord = await otpCol.findOne({ phone: cleanPhone })

    if (!otpRecord) {
      return NextResponse.json(
        { error: "No OTP found. Please request a new OTP." },
        { status: 404 }
      )
    }

    // Check expiry
    if (new Date() > new Date(otpRecord.expiresAt)) {
      return NextResponse.json(
        { error: "OTP has expired. Please request a new OTP." },
        { status: 410 }
      )
    }

    // Check max verification attempts (prevent brute force)
    if (otpRecord.attempts >= 5) {
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new OTP." },
        { status: 429 }
      )
    }

    // Verify OTP
    if (otpRecord.otp !== otp.trim()) {
      // Increment attempts
      await otpCol.updateOne(
        { phone: cleanPhone },
        { $inc: { attempts: 1 } }
      )
      return NextResponse.json(
        { error: "Invalid OTP. Please try again." },
        { status: 400 }
      )
    }

    // Mark as verified
    const verificationToken = generateVerificationToken()
    await otpCol.updateOne(
      { phone: cleanPhone },
      {
        $set: {
          verified: true,
          verificationToken,
          verifiedAt: new Date()
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: "Phone number verified successfully!",
      verificationToken
    })
  } catch (error) {
    console.error("OTP verify error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function generateVerificationToken(): string {
  // This token is the bearer credential that proves OTP verification, so it
  // has to be unguessable. Math.random() is a seeded PRNG whose future output
  // can be reconstructed from observed values; randomBytes is a CSPRNG.
  return randomBytes(24).toString("base64url")
}
