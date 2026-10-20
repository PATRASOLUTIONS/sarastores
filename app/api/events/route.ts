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
}, { windowMs: 60 * 1000, maxRequests: 120, message: "Too many events." })
