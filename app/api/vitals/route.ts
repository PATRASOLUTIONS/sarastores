import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"
import { withRateLimit } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

/*
 * Only the metrics lib/performance.ts actually reports. Storing a free-form
 * name lets an anonymous caller fill the collection with rows that no
 * dashboard can group, which is worse than dropping them.
 */
const vitalsSchema = z.object({
  name: z.enum(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]),
  value: z.number().finite().min(0).max(3_600_000),
  rating: z.enum(["good", "needs-improvement", "poor"]).optional(),
  delta: z.number().finite().min(-3_600_000).max(3_600_000).optional(),
  id: z.string().max(60).optional(),
  // Browsers disagree on the spelling here and new values appear over time, so
  // an unexpected one is capped rather than used to discard a valid metric.
  navigationType: z.string().max(30).optional(),
  page: z.string().max(300).optional(),
})

/**
 * Web Vitals beacon. Anonymous by design — the measurement happens before we
 * know who the visitor is — so the budget is the only thing bounding how many
 * documents a caller can write.
 */
export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const parsed = vitalsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 })
    const metric = parsed.data

    // Persisted so per-route INP/LCP can actually be queried later.
    const vitals = await getCollection("web_vitals")
    await vitals.insertOne({
      name: metric.name,
      value: metric.value,
      rating: metric.rating ?? "",
      delta: metric.delta ?? 0,
      metricId: metric.id ?? "",
      navigationType: metric.navigationType ?? "",
      page: metric.page ?? "",
      createdAt: new Date(),
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  // A real session reports about five metrics per navigation, and an office or
  // mobile-carrier NAT shares one address, so the budget matches /api/events.
  // Dropping a beacon has no user-visible effect.
}, { windowMs: 60 * 1000, maxRequests: 120, message: "Too many measurements." })
