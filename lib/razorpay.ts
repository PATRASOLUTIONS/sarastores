import Razorpay from "razorpay"
import { z } from "zod"
import { PaymentConfigurationError } from "@/lib/payment-config"

function razorpayCredentials(opts?: { keyId?: string; keySecret?: string }) {
  const key_id = (opts?.keyId || process.env.RAZORPAY_KEY_ID)?.trim()
  const key_secret = (opts?.keySecret || process.env.RAZORPAY_KEY_SECRET)?.trim()
  if (!key_id || !key_secret) {
    throw new PaymentConfigurationError("Razorpay credentials are not configured")
  }
  return { key_id, key_secret }
}

/**
 * Razorpay factory: create a client per partner/environment using provided credentials,
 * falling back to global env keys when missing.
 */
export function getRazorpayClient(opts?: { keyId?: string; keySecret?: string }) {
  return new Razorpay(razorpayCredentials(opts))
}

export function getRazorpayKeyId(keyId?: string) {
  return (keyId || process.env.RAZORPAY_KEY_ID)?.trim()
}

export class RazorpayOrderError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message)
    this.name = "RazorpayOrderError"
  }
}

const GatewayOrderSchema = z.object({
  id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
})

/** No automatic retry: a timeout may occur after the gateway created an order. */
export async function createRazorpayOrder(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 100) {
    throw new RazorpayOrderError("Online payments require a total of at least ₹1.", 400, "PAYMENT_AMOUNT_INVALID")
  }
  const { key_id, key_secret } = razorpayCredentials()
  let response: Response
  try {
    // The installed SDK assumes every failure has an HTTP response. A DNS or
    // connection failure instead throws a TypeError and loses the real cause.
    response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key_id}:${key_secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, currency: "INR", receipt: `receipt_${Date.now()}` }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
    const cause = error instanceof Error ? error.cause : null
    const networkCode = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : ""
    console.error("[razorpay] Connection failed", {
      timeout,
      code: ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(networkCode)
        ? networkCode : "NETWORK_ERROR",
    })
    throw new RazorpayOrderError(
      timeout ? "Razorpay took too long to respond. Please try again shortly." : "Unable to connect to Razorpay. Please try again shortly.",
      503,
      timeout ? "PAYMENT_GATEWAY_TIMEOUT" : "PAYMENT_GATEWAY_UNREACHABLE",
    )
  }

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const providerError = z.object({ error: z.object({
      code: z.string().optional(), description: z.string().optional(), field: z.string().nullish(),
    }) }).safeParse(payload)
    const detail = providerError.success ? providerError.data.error : null
    // Log only gateway diagnostics, never request headers, credentials or PII.
    const redact = (value?: string | null) => value?.split(key_id).join("[redacted]").split(key_secret).join("[redacted]").slice(0, 500)
    console.error("[razorpay] Order rejected", {
      status: response.status, code: redact(detail?.code), field: redact(detail?.field), description: redact(detail?.description),
    })
    if (response.status === 401 || response.status === 403) {
      throw new RazorpayOrderError("The payment gateway could not authenticate this store. Please contact support.", 503, "PAYMENT_GATEWAY_AUTHENTICATION_FAILED")
    }
    if (response.status === 429 || response.status >= 500) {
      throw new RazorpayOrderError("Razorpay is temporarily unavailable. Please try again shortly.", 503, "PAYMENT_GATEWAY_UNAVAILABLE")
    }
    if (detail?.field === "amount") {
      throw new RazorpayOrderError("Razorpay does not accept this payment amount. Please contact support.", 400, "PAYMENT_AMOUNT_REJECTED")
    }
    throw new RazorpayOrderError("Razorpay rejected the payment request. Please contact support.", 502, "PAYMENT_GATEWAY_REJECTED")
  }

  const order = GatewayOrderSchema.safeParse(payload)
  if (!order.success || order.data.amount !== amount) {
    console.error("[razorpay] Invalid order response", { status: response.status })
    throw new RazorpayOrderError("Razorpay returned an invalid payment order. Please try again shortly.", 502, "PAYMENT_GATEWAY_INVALID_RESPONSE")
  }
  return order.data
}

/**
 * Confirms with Razorpay that the payment was actually captured for the expected
 * amount. Never trust the client's word that a payment succeeded.
 */
export async function verifyRazorpayPayment(
  razorpayPaymentId: string,
  expectedAmount: number,
  expectedOrderId?: string,
  expectedCurrency = "INR",
): Promise<{ verified: boolean; reason?: string; amountPaid?: number }> {
  try {
    const payment = await getRazorpayClient().payments.fetch(razorpayPaymentId)
    if (!payment) return { verified: false, reason: "payment_not_found" }

    const status = String(payment.status || "")
    if (status !== "captured") {
      return { verified: false, reason: `payment_status_${status || "unknown"}` }
    }

    const amountPaid = Number(payment.amount) / 100
    if (Number(payment.amount) !== Math.round(expectedAmount * 100)) {
      return { verified: false, reason: "amount_mismatch", amountPaid }
    }
    if (payment.currency !== expectedCurrency) return { verified: false, reason: "currency_mismatch" }
    if (!expectedOrderId || payment.order_id !== expectedOrderId) {
      return { verified: false, reason: "checkout_mismatch" }
    }

    return { verified: true, amountPaid }
  } catch (error) {
    console.error("[razorpay] payment verification failed:", error instanceof Error ? error.message : error)
    return { verified: false, reason: "verification_error" }
  }
}
