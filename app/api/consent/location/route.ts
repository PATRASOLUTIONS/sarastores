import { randomUUID } from "node:crypto"
import { type NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { withRateLimit } from "@/lib/rate-limit"
import { rateLimitHit } from "@/lib/rate-limit-store"
import { COLLECTION_CONSENT_RECORDS, CONSENT_PURPOSES, recordConsent } from "@/lib/consent"
import { DELIVERY_LOCATION_NOTICE_VERSION } from "@/lib/dpdp-config"
import { DeliveryLocationRequestSchema, pincodeSchema } from "@/lib/validation"

export const dynamic = "force-dynamic"
const headers = { "Cache-Control": "private, no-store" }
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers })

// Public by design: guests can select a delivery area. Account identity always
// comes from the session; coordinates never enter the consent ledger or logs.
export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin")
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return reply({ error: "Location consent must be given on this website." }, 403)
    }
    const parsed = DeliveryLocationRequestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return reply({ error: "Invalid location request." }, 400)
    const data = parsed.data
    const session = await getSession()
    const userId = session?.user?.id ?? null
    const append = (receipt: string, granted: boolean) => recordConsent({
      userId,
      anonymousId: receipt,
      decisions: [{ purpose: CONSENT_PURPOSES.DELIVERY_LOCATION, granted }],
      source: "delivery_location",
      noticeVersion: DELIVERY_LOCATION_NOTICE_VERSION,
      // Deliberately omit request IP and user agent from this optional record.
    })

    if (data.action === "grant") {
      if (data.version !== DELIVERY_LOCATION_NOTICE_VERSION) {
        return reply({ error: "The location notice has changed. Refresh and try again." }, 409)
      }
      const receipt = randomUUID()
      if (await append(receipt, true) !== 1) {
        return reply({ error: "Could not save your consent. Please enter your pincode manually." }, 503)
      }
      return reply({ receipt })
    }

    const collection = await getCollection(COLLECTION_CONSENT_RECORDS)
    const decision = await collection.findOne({
      anonymousId: data.receipt, userId, purpose: CONSENT_PURPOSES.DELIVERY_LOCATION,
    }, { sort: { createdAt: -1, _id: -1 }, projection: { granted: 1, createdAt: 1, noticeVersion: 1 } })

    if (data.action === "withdraw") {
      if (decision?.granted && await append(data.receipt, false) !== 1) {
        return reply({ error: "Could not record withdrawal. Your device has stopped location access; please retry." }, 503)
      }
      return reply({ success: true })
    }

    if (!decision?.granted || decision.noticeVersion !== DELIVERY_LOCATION_NOTICE_VERSION ||
      Date.now() - new Date(decision.createdAt).getTime() > 5 * 60 * 1000) {
      return reply({ error: "Location consent expired or was withdrawn. Please agree again." }, 403)
    }
    if (userId) {
      const accountWithdrawal = await collection.findOne({
        userId, anonymousId: null, purpose: CONSENT_PURPOSES.DELIVERY_LOCATION, granted: false,
      }, { sort: { createdAt: -1, _id: -1 }, projection: { createdAt: 1 } })
      if (accountWithdrawal && new Date(accountWithdrawal.createdAt).getTime() >= new Date(decision.createdAt).getTime()) {
        return reply({ error: "Location consent was withdrawn in your account. Please agree again." }, 403)
      }
    }
    // Keep consent valid during processing, then end it before returning.
    // Another detection always requires fresh consent in the client.
    try {
    if (request.signal.aborted) return reply({ error: "Location lookup cancelled." }, 408)
    // Nominatim's public service budget applies across users and server instances.
    const providerBudget = await rateLimitHit("delivery-location:nominatim", 1, 1000)
    if (providerBudget.limited) return reply({ error: "Location lookup is busy. Wait a moment and try again, or enter your pincode manually." }, 429)

    const url = new URL("https://nominatim.openstreetmap.org/reverse")
    url.search = new URLSearchParams({
      format: "jsonv2", lat: data.latitude.toFixed(3), lon: data.longitude.toFixed(3),
      zoom: "18", addressdetails: "1", "accept-language": "en",
    }).toString()
    // Do not log provider errors: they can include a URL containing coordinates.
    try {
      const response = await fetch(url, {
        cache: "no-store", signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
        headers: { "User-Agent": "SaraStores-DeliveryPincode/1.0", Accept: "application/json" },
      })
      if (!response.ok) return reply({ error: "Location lookup is unavailable. Enter your pincode manually." }, 502)
      const result = await response.json()
      const postcode = result?.address?.postcode
      const pincode = pincodeSchema.safeParse(typeof postcode === "string" ? postcode.trim() : postcode)
      if (result?.address?.country_code !== "in" || !pincode.success || !/^[1-9]/.test(pincode.data)) {
        return reply({ error: "Could not find an Indian pincode here. Please enter it manually." }, 422)
      }
      return reply({ pincode: pincode.data })
    } catch {
      return reply({ error: "Location lookup timed out or was cancelled. Enter your pincode manually." }, 502)
    }
    } finally {
      if (await append(data.receipt, false) !== 1) {
        return reply({ error: "Could not complete the consent record. Enter your pincode manually." }, 503)
      }
    }
  } catch (error) {
    return handleApiError(error, "Could not process location consent")
  }
}, { windowMs: 60 * 1000, maxRequests: 30, message: "Too many location requests. Please try again shortly." })
