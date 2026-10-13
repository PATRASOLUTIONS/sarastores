import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { verifyRazorpayPayment } from "@/lib/razorpay"
import { getCheckoutIntent, type CheckoutIntent } from "@/lib/checkout-payment"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"

const VerifySchema = z.object({
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
  checkoutToken: z.string().min(20).max(100),
})

export async function POST(request: Request) {
  try {
    const parsed = VerifySchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment verification data" }, { status: 400 })
    const data = parsed.data
    const session = await getSession()
    const intent = await getCheckoutIntent(data.razorpay_order_id, data.checkoutToken, session?.user.id || null)
    if (!intent || intent.method !== "razorpay" || intent.status === "consumed") {
      return NextResponse.json({ error: "Checkout is missing, expired or already completed" }, { status: 409 })
    }
    const secret = process.env.RAZORPAY_KEY_SECRET
    if (!secret) return NextResponse.json({ error: "Payment verification is not configured" }, { status: 503 })
    const signature = crypto.createHmac("sha256", secret)
      .update(`${intent._id}|${data.razorpay_payment_id}`).digest("hex")
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(data.razorpay_signature))) {
      return NextResponse.json({ error: "Payment verification failed" }, { status: 400 })
    }
    const check = await verifyRazorpayPayment(data.razorpay_payment_id, intent.amount / 100, intent._id, intent.currency)
    if (!check.verified) return NextResponse.json({ error: "Payment could not be verified", reason: check.reason }, { status: check.reason === "verification_error" ? 503 : 400 })
    const collection = await getCollection<CheckoutIntent>("checkout_intents")
    const result = await collection.updateOne(
      { _id: intent._id, status: { $in: ["created", "verified"] }, $or: [{ paymentId: { $exists: false } }, { paymentId: data.razorpay_payment_id }] },
      { $set: { status: "verified", paymentId: data.razorpay_payment_id } },
    )
    if (!result.matchedCount) return NextResponse.json({ error: "Checkout has already been completed" }, { status: 409 })
    return NextResponse.json({
      success: true, paymentId: data.razorpay_payment_id, orderId: intent._id,
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    return handleApiError(error, "Payment verification failed")
  }
}
