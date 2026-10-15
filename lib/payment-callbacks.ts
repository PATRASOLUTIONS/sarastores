import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import type { CheckoutIntent } from "@/lib/checkout-payment"
import { verifyPineCallback, verifyPaytmCallback } from "@/lib/hosted-payment-providers"
import { paymentSetting } from "@/lib/payment-config"
import type { HostedPaymentProvider } from "@/types/payment-gateways"

export function hostedProvider(value: string): HostedPaymentProvider | null {
  return value === "pinelabs" || value === "paytm" ? value : null
}

export async function callbackFields(request: Request): Promise<Record<string, string>> {
  if (request.method === "GET") return Object.fromEntries(new URL(request.url).searchParams)
  const text = await request.text()
  if (Buffer.byteLength(text) > 65536) throw new Error("Payment callback payload is too large")
  if (request.headers.get("content-type")?.includes("application/json")) {
    return z.record(z.string().max(2000)).parse(JSON.parse(text))
  }
  return Object.fromEntries(new URLSearchParams(text))
}

export async function findHostedCallbackIntent(provider: HostedPaymentProvider, fields: Record<string, string>) {
  const valid = provider === "pinelabs" ? verifyPineCallback(fields) : verifyPaytmCallback(fields)
  if (!valid) return null
  if (provider === "paytm" && fields.MID !== paymentSetting("PAYTM_MERCHANT_ID")) return null
  const id = provider === "pinelabs" ? fields.order_id : fields.ORDERID
  if (!id || id.length > 100) return null
  return (await getCollection<CheckoutIntent>("checkout_intents")).findOne({ _id: id, method: provider })
}
