import crypto from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"

interface CheckoutRequest {
  _id: string
  userId: string | null
  payloadHash: string
  state: "processing" | "finished" | "uncertain"
  createdAt: Date
  response?: { status: number; body: unknown; retrySafe?: boolean }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
  return value
}

// The built-in unique _id index claims an attempt BEFORE calling any provider.
// Never expire or reclaim a processing attempt: a timed-out provider might have
// already created a payable session. Such attempts need reconciliation, not a charge retry.
export async function idempotentCheckout(
  request: NextRequest, userId: string | null, scope: string,
  work: () => Promise<Response>, required = true,
): Promise<Response> {
  const key = request.headers.get("Idempotency-Key")
  const headers = { "Cache-Control": "private, no-store" }
  if (!key && !required) return work()
  if (!key || !/^[a-f0-9-]{36,80}$/i.test(key)) return NextResponse.json({
    error: "Refresh checkout before starting payment.", code: "CHECKOUT_REQUEST_KEY_REQUIRED",
  }, { status: 400, headers })
  const body = await request.clone().json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid checkout request" }, { status: 400, headers })
  const digest = (value: string) => crypto.createHash("sha256").update(value).digest("hex")
  const id = digest(`${scope}:${key}`)
  const payloadHash = digest(JSON.stringify(canonical(body)))
  const collection = await getCollection<CheckoutRequest>("checkout_requests")
  try {
    await collection.insertOne({ _id: id, userId, payloadHash, state: "processing", createdAt: new Date() })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    const existing = await collection.findOne({ _id: id })
    if (!existing || existing.userId !== userId || existing.payloadHash !== payloadHash) return NextResponse.json({
      error: "Checkout changed during payment setup. Return to the original checkout before retrying.", code: "CHECKOUT_REQUEST_CHANGED",
    }, { status: 409, headers })
    // Do not reopen a payable session after its checkout capability has expired.
    // Keep the record claimed so an old link cannot lead to another new session.
    const replayWindow = scope === "store-request" ? 23 * 60 * 60 * 1000 : 55 * 60 * 1000
    if (existing.response?.status === 200 && Date.now() - existing.createdAt.getTime() > replayWindow) return NextResponse.json({
      error: "Your previous checkout request has expired. Contact support to confirm its payment status before paying again.",
      code: "CHECKOUT_REQUEST_EXPIRED", reference: id.slice(0, 16),
    }, { status: 409, headers })
    if (existing.response) return NextResponse.json(existing.response.body, {
      status: existing.response.status, headers: { ...headers, "Idempotency-Replayed": "true", ...(existing.response.retrySafe ? { "Checkout-Retry-Safe": "true" } : {}) },
    })
    return NextResponse.json({ error: "Your previous payment request is still being confirmed. Retry this checkout shortly; do not start a new payment.",
      code: existing.state === "uncertain" ? "CHECKOUT_REQUEST_UNCERTAIN" : "CHECKOUT_REQUEST_IN_PROGRESS",
      reference: id.slice(0, 16),
    }, { status: 409, headers: { ...headers, "Retry-After": "3" } })
  }
  try {
    const response = await work()
    response.headers.set("Cache-Control", headers["Cache-Control"])
    const retrySafe = response.headers.get("Checkout-Retry-Safe") === "true"
    const result = response.status >= 500 && !retrySafe ? {
      error: "Your payment request could not be confirmed. Do not start another payment. Retry this checkout or contact support with the reference below.",
      code: "CHECKOUT_REQUEST_UNCERTAIN", reference: id.slice(0, 16),
    } : await response.clone().json()
    // Failures after provider invocation remain bound to this attempt as well.
    // A retry must not silently create a second session after an ambiguous timeout.
    await collection.updateOne({ _id: id, state: "processing" }, { $set: {
      state: response.status >= 500 && !retrySafe ? "uncertain" : "finished",
      response: { status: response.status, body: result, retrySafe },
    } })
    return response.status >= 500 && !retrySafe ? NextResponse.json(result, { status: response.status, headers }) : response
  } catch (error) {
    await collection.updateOne({ _id: id, state: "processing" }, { $set: { state: "uncertain" } })
    throw error
  }
}
