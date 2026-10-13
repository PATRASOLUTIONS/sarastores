import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { getSession } from "@/lib/auth"
import { sendEmail } from "@/lib/email"
import { handleApiError } from "@/lib/api-error"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { CheckoutQuoteSchema, quoteCheckout, createCheckoutIntent, type CheckoutIntent } from "@/lib/checkout-payment"

const StorePurchaseSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  employeeId: z.string().trim().min(1).max(100),
  action: z.enum(["verify", "validate"]),
  otp: z.string().regex(/^\d{6}$/).optional(),
  challengeId: z.string().uuid().optional(),
  checkout: CheckoutQuoteSchema,
})

interface StoreChallenge {
  _id: string
  userId: string | null
  employeeId: string
  employeeEmail: string
  fingerprint: string
  otpHash: string
  attempts: number
  consumed: boolean
  expiresAt: Date
}

export async function POST(request: NextRequest) {
  try {
    const limit = await checkRateLimit(request, RATE_LIMITS.AUTH)
    if (!limit.success) return NextResponse.json({ success: false, message: RATE_LIMITS.AUTH.message }, { status: 429 })
    const parsed = StorePurchaseSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, message: parsed.error.issues[0].message }, { status: 400 })
    const data = parsed.data
    const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET
    if (!secret || secret.length < 16) {
      return NextResponse.json({ success: false, message: "Store approval is not configured" }, { status: 503 })
    }
    const employee = await (await getCollection("employees")).findOne({
      employeeId: data.employeeId, email: data.email, status: "active",
    })
    if (!employee) return NextResponse.json({ success: false, message: "Invalid employee credentials" }, { status: 400 })
    const session = await getSession()
    const userId = session?.user.id || null
    const quote = await quoteCheckout(data.checkout.items, { ...data.checkout, userId })
    if (!quote.ok) return NextResponse.json({ success: false, message: quote.error }, { status: 400 })
    const challenges = await getCollection<StoreChallenge>("store_purchase_challenges")
    const otpHash = (id: string, otp: string) =>
      crypto.createHmac("sha256", secret).update(`${id}:${otp}`).digest("hex")

    if (data.action === "verify") {
      const challengeId = crypto.randomUUID()
      const otp = crypto.randomInt(100000, 1000000).toString()
      await challenges.insertOne({
        _id: challengeId, userId, employeeId: data.employeeId, employeeEmail: data.email,
        fingerprint: quote.fingerprint, otpHash: otpHash(challengeId, otp), attempts: 0,
        consumed: false, expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      })
      try {
        const sent = await sendEmail({
          to: employee.email,
          subject: "Approve an in-store purchase",
          html: `<p>Approval code: <strong>${otp}</strong></p><p>Purchase amount: INR ${quote.amount.toFixed(2)}. Items: ${quote.pricing.items.length}.</p><p>Only enter this code after confirming receipt of payment for this checkout. It expires in five minutes.</p>`,
        })
        if (!sent.success) throw new Error("Employee approval email could not be sent")
      } catch (error) {
        await challenges.deleteOne({ _id: challengeId })
        throw error
      }
      return NextResponse.json({ success: true, challengeId, message: "Approval code sent to the employee" }, {
        headers: { "Cache-Control": "private, no-store" },
      })
    }

    if (!data.challengeId || !data.otp) {
      return NextResponse.json({ success: false, message: "Approval code and challenge are required" }, { status: 400 })
    }
    const challenge = await challenges.findOneAndUpdate({
      _id: data.challengeId, userId, employeeId: data.employeeId, employeeEmail: data.email,
      fingerprint: quote.fingerprint, consumed: false, attempts: { $lt: 5 }, expiresAt: { $gt: new Date() },
    }, { $inc: { attempts: 1 } }, { returnDocument: "after" })
    if (!challenge || !crypto.timingSafeEqual(Buffer.from(challenge.otpHash), Buffer.from(otpHash(challenge._id, data.otp)))) {
      return NextResponse.json({ success: false, message: "Invalid, expired or exhausted approval code" }, { status: 400 })
    }
    const consumed = await challenges.updateOne(
      { _id: challenge._id, consumed: false, expiresAt: { $gt: new Date() } },
      { $set: { consumed: true } },
    )
    if (!consumed.modifiedCount) return NextResponse.json({ success: false, message: "Approval code already used" }, { status: 409 })
    const approvalId = `store_${crypto.randomUUID()}`
    const approvalToken = await createCheckoutIntent(approvalId, userId, quote, "instore")
    await (await getCollection<CheckoutIntent>("checkout_intents")).updateOne(
      { _id: approvalId },
      { $set: { status: "verified", employeeId: data.employeeId, employeeEmail: data.email, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } },
    )
    return NextResponse.json({ success: true, approvalId, approvalToken, message: "Purchase approved" }, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch (error) {
    return handleApiError(error, "Store purchase approval failed")
  }
}
