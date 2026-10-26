import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { ScraperImportRowSchema, ScrapedProductSchema } from "@/lib/scrapers/bulk-import"
import { detectSource } from "@/lib/scrapers/http"
import { publishScrapedProduct } from "@/lib/scrapers/publish"
import { ScraperError } from "@/lib/scrapers/types"
import { existingScraperItemNumbers } from "@/lib/scrapers/item-numbers"
import { scraperItemNumberKey } from "@/lib/scrapers/bulk-import"

const schema = z.object({ row: ScraperImportRowSchema.extend({ url: z.string().trim().max(4096) }), product: ScrapedProductSchema,
  mode: z.enum(["publish", "draft"]).default("publish") })

export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  let requestedItemno = ""
  try {
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid product data" }, { status: 400 })
    const { row, product } = parsed.data
    requestedItemno = scraperItemNumberKey(row.itemno)
    if (!(parsed.data.mode === "draft" && product.source === "pdf") &&
      (!ScraperImportRowSchema.shape.url.safeParse(row.url).success || !detectSource(row.url) || detectSource(row.url) !== product.source)) {
      return NextResponse.json({ error: "Product link must match a supported scraper source" }, { status: 400 })
    }
    const saved = await publishScrapedProduct(row, product, parsed.data.mode === "publish")
    if (!saved) throw new Error("Scraper transaction did not complete")
    return NextResponse.json({ success: true, added: saved.added, skipped: !saved.added, itemno: saved.itemno,
      ...(saved.added ? { product: saved.product } : { message: saved.message }),
    })
  } catch (error) {
    if (error instanceof ScraperError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      // The unique specification key also serializes scraper inserts. The
      // product/specification transaction rolls back if another run wins.
      const itemno = requestedItemno
      if (itemno && (await existingScraperItemNumbers([itemno])).has(itemno)) {
        return NextResponse.json({ success: true, added: false, skipped: true, itemno, message: "Already exists — skipped" })
      }
      return NextResponse.json({ error: "This item changed concurrently. Check it again before retrying." }, { status: 409 })
    }
    return handleApiError(error, "Could not publish product and specifications")
  }
}
