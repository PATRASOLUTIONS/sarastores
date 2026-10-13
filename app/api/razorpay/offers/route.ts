import { NextResponse } from "next/server"
import { z } from "zod"
import { handleApiError } from "@/lib/api-error"

export const dynamic = "force-dynamic"

const upstreamOffer = z.object({
  id: z.string(), name: z.string().nullish(), terms: z.string().nullish(), display_text: z.string().nullish(),
  discount_percentage: z.number().nullish(), discount_amount: z.number().nullish(), min_amount: z.number().nullish(),
  max_discount: z.number().nullish(), payment_method: z.string().nullish(), active: z.boolean(),
  starts_at: z.number().nullish(), ends_at: z.number().nullish(), type: z.string().nullish(),
})
const BANKS = ["HDFC", "ICICI", "AXIS", "SBI", "KOTAK", "PAYTM", "PHONEPE", "GPAY", "AMAZON PAY"]

export async function GET() {
  const keyId = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !secret) {
    console.error("[Razorpay offers] Credentials are not configured")
    return NextResponse.json({ error: "Bank offers are currently unavailable" }, { status: 503 })
  }
  try {
    const response = await fetch("https://api.razorpay.com/v1/offers", {
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` },
      cache: "no-store", signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) {
      console.error("[Razorpay offers] Upstream request failed:", response.status)
      return NextResponse.json({ error: "Razorpay bank offers could not be loaded. Please retry." }, { status: 502 })
    }
    const data = z.object({ items: z.array(upstreamOffer) }).parse(await response.json())
    const items = data.items.map(offer => {
      const name = offer.name || offer.display_text || "Bank offer"
      const description = offer.terms || offer.display_text || ""
      const text = `${name} ${description}`.toUpperCase()
      return {
        id: offer.id, name, description, bank: BANKS.find(bank => text.includes(bank)) || "BANK",
        discount_percentage: offer.discount_percentage ?? null,
        discount_amount: offer.discount_amount == null ? null : offer.discount_amount / 100,
        min_amount: offer.min_amount == null ? null : offer.min_amount / 100,
        max_discount: offer.max_discount == null ? null : offer.max_discount / 100,
        payment_method: offer.payment_method || "card", active: offer.active,
        starts_at: offer.starts_at, ends_at: offer.ends_at, type: offer.type || "instant",
      }
    })
    return NextResponse.json({ items, count: items.length, source: "razorpay" }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return handleApiError(error, "Razorpay bank offers could not be loaded. Please retry.") }
}
