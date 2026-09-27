import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { getSession } from "@/lib/auth"
import { withRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const ALLOWED_EVENTS = new Set([
  "view_item", "add_to_cart", "remove_from_cart", "view_cart",
  "begin_checkout", "add_payment_info", "purchase",
  "search", "generate_lead", "sign_up", "login",
])

/** Funnel event sink. Public by design, so it is rate limited and allow-listed. */
export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null)
    const event = String(body?.event || "")
    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    const session = await getSession()
    const rawParams = body?.params && typeof body.params === "object" ? body.params : {}
    // Cap the stored payload without corrupting it — oversized params are dropped.
    const params = JSON.stringify(rawParams).length > 8000 ? {} : rawParams

    const events = await getCollection("analytics_events")
    await events.insertOne({
      event,
      params,
      page: String(body?.page || "").slice(0, 300),
      userId: session?.user?.id || null,
      referer: request.headers.get("referer")?.slice(0, 300) || null,
      createdAt: new Date(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
} as any, { windowMs: 60 * 1000, maxRequests: 120, message: "Too many events." })
