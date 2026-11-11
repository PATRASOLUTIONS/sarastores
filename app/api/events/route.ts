import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { getSession } from "@/lib/auth"
import { withRateLimit } from "@/lib/rate-limit"
import { consentedVisitor, trafficSource } from "@/lib/customer-flow-tracking"
import { CheckoutContactSchema, GuestCheckoutCustomerSchema } from "@/lib/validation"
import { recoveryConsentSchema } from '@/lib/recovery-policy'

export const dynamic = "force-dynamic"

const ALLOWED_EVENTS = new Set([
  "view_item", "add_to_cart", "remove_from_cart", "view_cart",
  "begin_checkout", "add_payment_info", "purchase",
  "search", "generate_lead", "sign_up", "login",
  "view_promotion", "select_promotion",
  "page_view", "browse_products", "guest_checkout", "checkout_started", "checkout_contact", "cart_snapshot", "cart_confirmed", "address_completed",
  "login_failed", "payment_failed", "payment_retried",
])

/** Funnel event sink. Public by design, so it is rate limited and allow-listed. */
export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const visitorId = consentedVisitor(request.cookies.get('dpdp_tracking_consent')?.value)
    if (!visitorId) return NextResponse.json({ ok: true, tracked: false })
    const body = await request.json().catch(() => null)
    const event = String(body?.event || "")
    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const session = await getSession()
    const context = ['address_completed','add_payment_info','checkout_contact'].includes(event)
      ? GuestCheckoutCustomerSchema.or(CheckoutContactSchema).safeParse(body?.checkoutContext) : null
    const checkoutContext = context?.success ? {
      name: `${context.data.firstName} ${context.data.lastName}`,
      email: context.data.email, phone: context.data.phone,
      ...('address' in context.data ? { address: context.data.address, city: context.data.city,
        state: context.data.state, pincode: context.data.zipCode, country: context.data.country } : {}),
    } : null
    const recoveryConsent=checkoutContext && event==='checkout_contact'?recoveryConsentSchema.safeParse(body?.recoveryConsent):null
    const rawParams = body?.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? (body.params as Record<string, unknown>)
      : {}
    /*
     * Keys arrive from an anonymous caller and are stored verbatim. A key
     * starting with "$" or containing "." is legal to insert but makes the
     * document unqueryable by the very field you want to group on, so those
     * keys are dropped. Nesting is flattened away for the same reason.
     */
    const safeParams: Record<string, string | number | boolean | null> = {}
    for (const [key, value] of Object.entries(rawParams)) {
      if (key.startsWith("$") || key.includes(".") || key.length > 64) continue
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
        safeParams[key] = typeof value === "string" ? value.slice(0, 300) : (value as number | boolean | null)
      }
      if (Object.keys(safeParams).length >= 40) break
    }
    // Cap the stored payload without corrupting it — oversized params are dropped.
    const params = JSON.stringify(safeParams).length > 8000 ? {} : safeParams
    const productIds = Array.isArray(rawParams.items) ? [...new Set(rawParams.items.slice(0,100).flatMap((item: unknown) => {
      if (!item || typeof item !== 'object') return []
      const id = (item as Record<string, unknown>).item_id
      return typeof id === 'string' && id.length <= 200 ? [id] : []
    }))] : []
    const ua = request.headers.get('user-agent') || ''
    const device = /iPad|Tablet/i.test(ua) ? 'Tablet' : /Mobile|Android|iPhone/i.test(ua) ? 'Mobile' : 'Desktop'

    const events = await getCollection("analytics_events")
    await events.insertOne({
      event,
      params,
      page: String(body?.page || "").slice(0, 300),
      userId: session?.user?.id || null,
      visitorId,
      productIds,
      device,
      trafficSource: trafficSource(typeof body?.referrer === 'string' ? body.referrer.slice(0,500) : request.headers.get('referer'),request.nextUrl.origin),
      ...(checkoutContext ? { checkoutContext } : {}),
      ...(recoveryConsent?.success?{recoveryConsent:{...recoveryConsent.data,acceptedAt:new Date(),source:'Checkout recovery opt-in'}}:{}),
      // Store only the source category, never query strings or full referrer URLs.
      createdAt: new Date(),
      timestamp: new Date(), // Existing DPDP retention index uses timestamp.
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}, { windowMs: 60 * 1000, maxRequests: 120, message: "Too many events." })
