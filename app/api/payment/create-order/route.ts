import { NextResponse } from "next/server"
import { getRazorpayClient, getRazorpayKeyId } from "@/lib/razorpay"
import { getPartnerById } from '@/lib/partner/service'
import { decrypt } from '@/lib/encryption'
import { getSession } from '@/lib/auth'
import { priceOrder } from '@/lib/order-pricing'
import { quoteRedemption } from '@/lib/loyalty'

export async function POST(request: Request) {
  try {
    // Guests can pay too. This endpoint only quotes an amount derived from the
    // catalogue — it reads no user data and creates no order.
    const session = await getSession()
    const userId = session?.user?.id ?? null

    const { items, couponCode, currency = "INR", receipt, notes, partnerId, environment, redeemPoints } = await request.json()

    // The charged amount is always derived from the catalogue, never from the client.
    const pricing = await priceOrder(items, { couponCode: couponCode ?? null, userId })
    if (!pricing.ok) {
      return NextResponse.json({ error: pricing.error }, { status: 400 })
    }

    // Must mirror the rewards discount applied in /api/orders, or the payment
    // verification there will reject the amount as a mismatch.
    let amount = pricing.total
    if (userId && Number(redeemPoints) > 0) {
      const quote = await quoteRedemption({
        userId,
        points: Number(redeemPoints),
        orderTotal: pricing.total,
      })
      if (!quote.ok) {
        return NextResponse.json({ error: quote.error }, { status: 400 })
      }
      amount = Math.max(0, pricing.total - quote.discount)
    }

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    // Upper bound: 50 lakhs (50,00,000)
    if (amount > 5000000) {
      return NextResponse.json({ error: "Amount exceeds maximum allowed limit" }, { status: 400 })
    }

    const options: any = {
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
      payment_capture: 1,
    }
    
    // Add notes if provided
    if (notes && Object.keys(notes).length > 0) {
      options.notes = notes
      console.log("Creating Razorpay order with notes:", JSON.stringify(notes, null, 2))
    }

    // Determine Razorpay client: partner-specific (if supplied) or global
    let client: any = null
    let keyIdToReturn = process.env.RAZORPAY_KEY_ID

    if (partnerId && environment) {
      // Try to load partner credentials
      const partner = await getPartnerById(partnerId)
      if (partner && (partner as any).razorpayIntegration && (partner as any).razorpayIntegration.credentials) {
        const creds = (partner as any).razorpayIntegration.credentials[environment]
        if (creds && creds.keyId && creds.keySecretEnc && creds.keySecretIv && creds.keySecretTag) {
          const secret = decrypt(creds.keySecretEnc, creds.keySecretIv, creds.keySecretTag)
          try {
            client = getRazorpayClient({ keyId: creds.keyId, keySecret: secret })
            keyIdToReturn = creds.keyId
          } catch (e) {
            console.warn('[create-order] Failed to create partner-specific razorpay client, falling back to global', e)
            client = null
          }
        }
      }
    }

    if (!client) {
      // Fallback to default global client
      client = getRazorpayClient()
      keyIdToReturn = getRazorpayKeyId()
    }

    const order = await client.orders.create(options)
    console.log("✅ Razorpay order created:", order.id)
    console.log("📝 Notes stored in order:", JSON.stringify(order.notes, null, 2))

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyIdToReturn,
      notes: order.notes, // Return notes for verification
    })
  } catch (error) {
    console.error("Error creating Razorpay order:", error)
    return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 })
  }
}
