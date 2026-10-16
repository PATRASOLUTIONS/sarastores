import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { ScraperImportRowSchema, ScrapedProductSchema } from "@/lib/scrapers/bulk-import"
import { detectSource } from "@/lib/scrapers/http"
import { publishScrapedProduct } from "@/lib/scrapers/publish"
import { ScraperError } from "@/lib/scrapers/types"

const schema = z.object({ row: ScraperImportRowSchema, product: ScrapedProductSchema })

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product data" }, { status: 400 })
    const { row, product } = parsed.data
    if (!detectSource(row.url) || detectSource(row.url) !== product.source) {
      return NextResponse.json({ error: "Product link must match a supported scraper source" }, { status: 400 })
    }
    const saved = await publishScrapedProduct(row, product)
    return NextResponse.json({ success: true, product: saved })
  } catch (error) {
    if (error instanceof ScraperError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      return NextResponse.json({ error: "This item was saved concurrently; retry the failed row" }, { status: 409 })
    }
    return handleApiError(error, "Could not publish product and specifications")
  }
}
