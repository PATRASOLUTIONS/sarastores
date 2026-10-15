import crypto from "node:crypto"
import PaytmChecksum from "paytmchecksum"
import { z } from "zod"
import { paymentEnvironment, paymentSetting, PaymentConfigurationError } from "@/lib/payment-config"
import type { HostedPaymentProvider } from "@/types/payment-gateways"

export class PaymentProviderError extends Error {}

export interface HostedPaymentRequest {
  reference: string
  amount: number
  userId: string | null
  callbackUrl: string
  customer: { firstName: string; lastName: string; email: string; phone: string | null }
}

export interface HostedProviderOrder {
  orderId: string
  redirectUrl: string
  formFields?: Record<string, string>
}

export type HostedVerification =
  | { status: "completed"; paymentId: string }
  | { status: "pending" | "failed" }

async function providerJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new PaymentProviderError(`Payment provider request failed (${response.status})`)
  try {
    return await response.json()
  } catch {
    throw new PaymentProviderError("Payment provider returned an invalid response")
  }
}

function pineBase() {
  return paymentEnvironment("PINELABS") === "uat" ? "https://pluraluat.v2.pinepg.in" : "https://api.pluralpay.in"
}

function pineHeaders() {
  return { "Content-Type": "application/json", Accept: "application/json", "Request-ID": crypto.randomUUID(), "Request-Timestamp": new Date().toISOString() }
}

async function pineToken() {
  const data = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(
    await providerJson(`${pineBase()}/api/auth/v1/token`, {
      method: "POST", headers: pineHeaders(),
      body: JSON.stringify({ client_id: paymentSetting("PINELABS_CLIENT_ID"), client_secret: paymentSetting("PINELABS_CLIENT_SECRET"), grant_type: "client_credentials" }),
    }),
  )
  return data.access_token
}

function pineSigningKey() {
  const key = paymentSetting("PINELABS_CALLBACK_SECRET")
  if (!/^(?:[a-fA-F0-9]{2}){16,}$/.test(key)) throw new PaymentConfigurationError("PINELABS_CALLBACK_SECRET must be a hex signing key from Pine Labs")
  return Buffer.from(key, "hex")
}

export function verifyPineCallback(fields: Record<string, string>): boolean {
  const signature = fields.signature
  if (!fields.order_id || !fields.status || !signature || !/^[a-fA-F0-9]{64}$/.test(signature)) return false
  const payload = ["error_code", "error_message", "order_id", "status"]
    .filter(key => Object.hasOwn(fields, key)).sort().map(key => `${key}=${fields[key]}`).join("&")
  const expected = crypto.createHmac("sha256", pineSigningKey()).update(payload).digest()
  return crypto.timingSafeEqual(expected, Buffer.from(signature, "hex"))
}

export function paytmBase() {
  return paymentEnvironment("PAYTM") === "uat" ? "https://securestage.paytmpayments.com" : "https://secure.paytmpayments.com"
}

function paytmKey() {
  const key = paymentSetting("PAYTM_MERCHANT_KEY")
  if (Buffer.byteLength(key) !== 16) throw new PaymentConfigurationError("PAYTM_MERCHANT_KEY must be the 16-byte merchant key")
  return key
}

export function verifyPaytmCallback(fields: Record<string, string>): boolean {
  const { CHECKSUMHASH, ...payload } = fields
  if (!CHECKSUMHASH || !/^[A-Za-z0-9+/]{107}=$/.test(CHECKSUMHASH)) return false
  try {
    return PaytmChecksum.verifySignature(payload, paytmKey(), CHECKSUMHASH)
  } catch (error) {
    if (error instanceof PaymentConfigurationError) throw error
    return false
  }
}

async function paytmRequest(path: string, body: Record<string, unknown>) {
  const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), paytmKey())
  const response = z.object({ head: z.object({ signature: z.string().regex(/^[A-Za-z0-9+/]{107}=$/) }), body: z.record(z.unknown()) }).parse(
    await providerJson(`${paytmBase()}${path}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, head: { signature } }),
    }),
  )
  if (!PaytmChecksum.verifySignature(JSON.stringify(response.body), paytmKey(), response.head.signature)) {
    throw new PaymentProviderError("Paytm response signature verification failed")
  }
  return response.body
}

export async function createHostedProviderOrder(provider: HostedPaymentProvider, request: HostedPaymentRequest): Promise<HostedProviderOrder> {
  if (!Number.isSafeInteger(request.amount) || request.amount < 100 || request.amount > 500000000) {
    throw new PaymentProviderError("Invalid payment amount")
  }
  if (provider === "pinelabs") {
    pineSigningKey()
    paymentSetting("PINELABS_MERCHANT_ID")
    const token = await pineToken()
    const data = z.object({ order_id: z.string().min(1).max(100), redirect_url: z.string().url(), response_code: z.literal(200) }).parse(
      await providerJson(`${pineBase()}/api/checkout/v1/orders`, {
        method: "POST", headers: { ...pineHeaders(), Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          merchant_order_reference: request.reference, order_amount: { value: request.amount, currency: "INR" },
          integration_mode: "REDIRECT", pre_auth: false,
          allowed_payment_methods: ["CARD", "UPI", "NETBANKING", "WALLET", "CREDIT_EMI", "DEBIT_EMI"],
          callback_url: request.callbackUrl, failure_callback_url: request.callbackUrl,
          purchase_details: { customer: {
            first_name: request.customer.firstName, last_name: request.customer.lastName,
            email_id: request.customer.email, ...(request.customer.phone ? { mobile_number: request.customer.phone } : {}), country_code: "91",
            customer_id: request.userId || request.reference,
          } },
        }),
      }),
    )
    const redirect = new URL(data.redirect_url)
    const allowed = paymentEnvironment("PINELABS") === "uat"
      ? ["pluraluat.v2.pinepg.in", "pluraluat.pinepg.in", "api.pluralonline.com"]
      : ["api.pluralpay.in", "api.pluralonline.com"]
    if (redirect.protocol !== "https:" || redirect.username || redirect.password || !allowed.includes(redirect.hostname)) {
      throw new PaymentProviderError("Pine Labs returned an unexpected checkout URL")
    }
    return { orderId: data.order_id, redirectUrl: data.redirect_url }
  }
  const mid = paymentSetting("PAYTM_MERCHANT_ID")
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(mid)) throw new PaymentConfigurationError("Invalid PAYTM_MERCHANT_ID")
  const data = z.object({ resultInfo: z.object({ resultStatus: z.literal("S") }), txnToken: z.string().min(1) }).parse(
    await paytmRequest(`/theia/api/v1/initiateTransaction?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(request.reference)}`, {
      requestType: "Payment", mid, orderId: request.reference,
      websiteName: process.env.PAYTM_WEBSITE_NAME || (paymentEnvironment("PAYTM") === "uat" ? "WEBSTAGING" : "DEFAULT"),
      txnAmount: { value: (request.amount / 100).toFixed(2), currency: "INR" },
      userInfo: { custId: request.userId || request.reference, ...(request.customer.phone ? { mobile: request.customer.phone } : {}), email: request.customer.email },
      callbackUrl: request.callbackUrl,
    }),
  )
  return {
    orderId: request.reference,
    redirectUrl: `${paytmBase()}/theia/api/v1/showPaymentPage?mid=${encodeURIComponent(mid)}&orderId=${encodeURIComponent(request.reference)}`,
    formFields: { mid, orderId: request.reference, txnToken: data.txnToken },
  }
}

export async function verifyHostedProviderPayment(
  provider: HostedPaymentProvider,
  expected: { orderId: string; reference: string; amount: number },
): Promise<HostedVerification> {
  if (provider === "pinelabs") {
    const token = await pineToken()
    const data = z.object({ data: z.object({
      order_id: z.string(), merchant_order_reference: z.string(), merchant_id: z.string(),
      status: z.string(), order_amount: z.object({ value: z.number().int(), currency: z.string() }),
      payments: z.array(z.object({
        id: z.string().min(1), status: z.string(),
        payment_amount: z.object({ value: z.number().int(), currency: z.string() }),
      })).optional(),
    }) }).parse(await providerJson(`${pineBase()}/api/pay/v1/orders/${encodeURIComponent(expected.orderId)}`, {
      method: "GET", headers: { ...pineHeaders(), Authorization: `Bearer ${token}` },
    })).data
    if (data.order_id !== expected.orderId || data.merchant_order_reference !== expected.reference ||
      data.merchant_id !== paymentSetting("PINELABS_MERCHANT_ID") ||
      data.order_amount.value !== expected.amount || data.order_amount.currency !== "INR") {
      throw new PaymentProviderError("Pine Labs payment does not match the checkout")
    }
    if (data.status === "PROCESSED") {
      const paid = data.payments?.filter(payment => payment.status === "PROCESSED")
      if (paid?.length !== 1 || paid[0].payment_amount.value !== expected.amount || paid[0].payment_amount.currency !== "INR") {
        throw new PaymentProviderError("Pine Labs captured amount does not match the checkout")
      }
      return { status: "completed", paymentId: paid[0].id }
    }
    if (["FAILED", "CANCELLED"].includes(data.status)) return { status: "failed" }
    if (["CREATED", "PENDING", "AUTHORIZED", "ATTEMPTED"].includes(data.status)) return { status: "pending" }
    throw new PaymentProviderError("Pine Labs payment status requires reconciliation")
  }
  const mid = paymentSetting("PAYTM_MERCHANT_ID")
  const data = z.object({
    resultInfo: z.object({ resultStatus: z.string() }),
    orderId: z.string().optional(), mid: z.string().optional(), txnAmount: z.string().optional(), txnId: z.string().optional(),
  }).parse(await paytmRequest("/v3/order/status", { mid, orderId: expected.orderId }))
  if (data.resultInfo.resultStatus === "NO_RECORD_FOUND") return { status: "pending" }
  if (data.orderId !== expected.orderId || data.mid !== mid) throw new PaymentProviderError("Paytm payment does not match the checkout")
  if (data.resultInfo.resultStatus === "TXN_SUCCESS") {
    if (!data.txnId || !data.txnAmount || !/^\d+(?:\.\d{1,2})?$/.test(data.txnAmount) ||
      Math.round(Number(data.txnAmount) * 100) !== expected.amount) {
      throw new PaymentProviderError("Paytm captured amount does not match the checkout")
    }
    return { status: "completed", paymentId: data.txnId }
  }
  if (data.resultInfo.resultStatus === "TXN_FAILURE") return { status: "failed" }
  if (["PENDING", "NO_RECORD_FOUND"].includes(data.resultInfo.resultStatus)) return { status: "pending" }
  throw new PaymentProviderError("Paytm payment status requires reconciliation")
}
