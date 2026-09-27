import Razorpay from "razorpay"

/**
 * Razorpay factory: create a client per partner/environment using provided credentials,
 * falling back to global env keys when missing.
 */
export function getRazorpayClient(opts?: { keyId?: string; keySecret?: string }) {
  const key_id = opts?.keyId || process.env.RAZORPAY_KEY_ID
  const key_secret = opts?.keySecret || process.env.RAZORPAY_KEY_SECRET
  if (!key_id || !key_secret) {
    throw new Error('Razorpay credentials are not configured for this context')
  }
  return new Razorpay({ key_id, key_secret })
}

export function getRazorpayKeyId(keyId?: string) {
  return keyId || process.env.RAZORPAY_KEY_ID
}

/**
 * Confirms with Razorpay that the payment was actually captured for the expected
 * amount. Never trust the client's word that a payment succeeded.
 */
export async function verifyRazorpayPayment(
  razorpayPaymentId: string,
  expectedAmount: number,
): Promise<{ verified: boolean; reason?: string; amountPaid?: number }> {
  try {
    const payment = await getRazorpayClient().payments.fetch(razorpayPaymentId)
    if (!payment) return { verified: false, reason: "payment_not_found" }

    const status = String(payment.status || "")
    if (status !== "captured" && status !== "authorized") {
      return { verified: false, reason: `payment_status_${status || "unknown"}` }
    }

    const amountPaid = Number(payment.amount) / 100
    if (Math.abs(amountPaid - expectedAmount) > 1) {
      return { verified: false, reason: "amount_mismatch", amountPaid }
    }

    return { verified: true, amountPaid }
  } catch (error) {
    console.error("[razorpay] payment verification failed:", error instanceof Error ? error.message : error)
    return { verified: false, reason: "verification_error" }
  }
}
