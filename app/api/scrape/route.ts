import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { detectSource, resolveRedirect } from "@/lib/scrapers/http"
import { ADAPTERS } from "@/lib/scrapers/adapters"
import { ScraperError, SCRAPER_LABELS, type ScrapedProduct } from "@/lib/scrapers/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Multi-source product scraper.
 *
 * Amazon keeps its own tuned route at /api/scrape-amazon; this handles the
 * remaining sources and returns the same normalised `ScrapedProduct` shape so
 * the admin UI and the specification pipeline do not care where data came from.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json().catch(() => ({}))
    const rawUrl = String(body?.url ?? "").trim()

    if (!rawUrl) {
      return NextResponse.json({ success: false, error: "A product URL is required" }, { status: 400 })
    }

    let source = detectSource(rawUrl)
    if (!source) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unsupported link. Use an Amazon, Flipkart, Reliance Digital, Vijay Sales, Bosch Home, Pai International or LG India product URL.",
        },
        { status: 400 },
      )
    }

    if (source === "amazon") {
      return NextResponse.json(
        { success: false, error: "Use /api/scrape-amazon for Amazon links", source },
        { status: 400 },
      )
    }

    // Short links carry no product identifier, so resolve before dispatching.
    let url = rawUrl
    if (/^(dl\.flipkart\.com|fkrt\.it)$/i.test(new URL(rawUrl).hostname.replace(/^www\./, ""))) {
      url = await resolveRedirect(rawUrl)
      source = detectSource(url) ?? source
    }

    const adapter = ADAPTERS[source as keyof typeof ADAPTERS]
    if (!adapter) {
      return NextResponse.json({ success: false, error: `No scraper for ${source}` }, { status: 400 })
    }

    const product: ScrapedProduct = await adapter(url)

    return NextResponse.json({
      success: true,
      source,
      sourceLabel: SCRAPER_LABELS[source],
      product,
    })
  } catch (error: any) {
    if (error instanceof ScraperError) {
      return NextResponse.json(
        { success: false, error: error.message, hint: error.hint },
        { status: error.status },
      )
    }
    console.error("[scrape] failed:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Scrape failed" },
      { status: 500 },
    )
  }
}
