import { NextRequest, NextResponse } from "next/server"
import { createHash, randomInt } from "node:crypto"
import { sendOtpEmail, sendWhatsAppOTP } from "@/lib/spin-wheel-notifications"
import { getCampaignCollection, resolveCampaignSlug } from "@/lib/spin-wheel-campaigns"
import { SpinOtpRequestSchema } from "@/lib/validation"
import { rateLimitHit } from "@/lib/rate-limit-store"
import { clientAddress } from "@/lib/client-address"
import { handleApiError } from "@/lib/api-error"

export const maxDuration = 15

export async function POST(request: NextRequest) {
  try {
    const parsed = SpinOtpRequestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Valid phone, email and name are required" }, { status: 400 })
    const { phone, email, name, senderNumber, campaignId } = parsed.data
    const campaignSlug = resolveCampaignSlug(campaignId)
    if (!campaignSlug) return NextResponse.json({ error: "Unknown campaign" }, { status: 400 })

    /*
     * Each send costs a real WhatsApp message and a real email. The per-phone
     * budget below stops one number being bombarded, but on its own it lets a
     * caller walk a list of numbers and spend three messages on each. This
     * bounds what any single caller can spend, whoever they claim to be.
     */
    const perCaller = await rateLimitHit(`spin-otp-ip:${clientAddress(request)}`, 10, 15 * 60 * 1000)
    if (perCaller.limited) {
      return NextResponse.json({ error: "Too many OTP requests. Please try again after some time." }, { status: 429 })
    }

    const otpCol = await getCampaignCollection(campaignSlug, "otps")
    const participantsCol = await getCampaignCollection(campaignSlug, "participants")
    if (await participantsCol.findOne({ $or: [{ phone }, { email }] })) {
      return NextResponse.json({ error: "duplicate", message: "You have already participated. You cannot spin again." }, { status: 409 })
    }
    const key = createHash("sha256").update(`${campaignSlug}:${phone}`).digest("hex")
    const limit = await rateLimitHit(`spin-otp:${key}`, 3, 15 * 60 * 1000)
    if (limit.limited) return NextResponse.json({ error: "Too many OTP requests. Please try again after some time." }, { status: 429 })

    const otp = String(randomInt(100000, 1000000))
    await otpCol.updateOne({ phone }, {
      $set: {
        otp, email, name,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        verified: false, attempts: 0, createdAt: new Date(),
      },
      $unset: { verificationToken: "", verifiedAt: "" },
    }, { upsert: true })

    const [emailResult, whatsappResult] = await Promise.allSettled([
      sendOtpEmail(email, name, otp),
      sendWhatsAppOTP(phone, otp, senderNumber),
    ])
    const emailAccepted = emailResult.status === "fulfilled" && emailResult.value.success
    const whatsappAccepted = whatsappResult.status === "fulfilled" && whatsappResult.value.success
    if (!emailAccepted) console.error("[Spin OTP] Email delivery failed")
    if (!whatsappAccepted) console.error("[Spin OTP] WhatsApp delivery failed")
    if (!emailAccepted && !whatsappAccepted) {
      // Do not delete a newer concurrent challenge for the same phone.
      await otpCol.deleteOne({ phone, otp })
      return NextResponse.json({ error: "Unable to send an OTP. Please try again later." }, { status: 502 })
    }
    return NextResponse.json({
      success: true,
      message: emailAccepted && whatsappAccepted ? "OTP sent to your email and WhatsApp." : emailAccepted ? "OTP sent to your email." : "OTP accepted for delivery to your WhatsApp.",
      delivery: { email: emailAccepted, whatsapp: whatsappAccepted },
      expiresIn: 300,
    })
  } catch (error) {
    return handleApiError(error, "Failed to send OTP")
  }
}
