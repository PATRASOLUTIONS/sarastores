import { NextResponse } from "next/server"
import { z } from "zod"
import { requireFullAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { ScraperImportRowSchema, scraperItemNumberKey } from "@/lib/scrapers/bulk-import"
import { detectSource } from "@/lib/scrapers/http"
import { ScraperError } from "@/lib/scrapers/types"
import { scraperItemNumberQuery } from "@/lib/scrapers/item-numbers"
import { catalogueItemNumber } from "@/lib/catalogue-quality-data"
import { MERCHANT_ENRICHMENT_COLLECTION, curateMerchantEnrichment, merchantCatalogueFacts, enrichmentMerchantPreview, extractMerchantEnrichment, storeMerchantEnrichment, type MerchantEnrichment } from "@/lib/scrapers/merchant-enrichment"

export const dynamic = "force-dynamic"
export const maxDuration = 180
const headers = { "Cache-Control": "no-store" }
const schema = z.object({ row: ScraperImportRowSchema, mode: z.enum(["preview", "store"]).default("preview") }).strict()

export async function GET(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const values = new URL(request.url).searchParams.getAll("itemno")
    const parsed = z.array(ScraperImportRowSchema.shape.itemno).min(1).max(500).safeParse(values)
    if (!parsed.success) return NextResponse.json({ error: "Provide 1–500 item numbers" }, { status: 400, headers })
    const keys = [...new Set(parsed.data.map(scraperItemNumberKey))]
    const saved = await (await getCollection<{ _id: string; status: string; enrichment: MerchantEnrichment }>(MERCHANT_ENRICHMENT_COLLECTION)).find({ _id: { $in: keys }, status: "complete" },
      { maxTimeMS: 10000 }).toArray()
    const products = await (await getCollection("products")).find(scraperItemNumberQuery(keys), { projection: {
      sku: 1, itemno: 1, "raw.itemno": 1, slug: 1, price: 1, stock: 1, quantity: 1, active: 1, inStock: 1, status: 1,
      disabled: 1, enabled: 1, isActive: 1, deleted: 1, isDeleted: 1, deletedAt: 1, discontinued: 1, condition: 1 }, maxTimeMS: 10000 }).limit(1001).toArray()
    if (products.length > 1000) return NextResponse.json({ error: "Too many catalogue matches; use smaller batches" }, { status: 413, headers })
    const catalogue: Record<string, unknown> = {}
    for (const key of keys) {
      const matches = products.filter(product => scraperItemNumberKey(catalogueItemNumber(product)) === key)
      if (matches.length === 1) catalogue[key] = merchantCatalogueFacts(matches[0])
    }
    return NextResponse.json({ saved: saved.map(record => curateMerchantEnrichment(record.enrichment)), catalogue }, { headers })
  } catch (error) { return handleApiError(error, "Could not read saved enrichment") }
}

export async function POST(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  try {
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403, headers })
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid scraper request" }, { status: 400, headers })
    const { row, mode } = parsed.data
    if (!detectSource(row.url)) return NextResponse.json({ error: "Unsupported product website" }, { status: 400, headers })
    const result = mode === "store" ? await storeMerchantEnrichment(row, guard.user.id)
      : { skipped: false, enrichment: await extractMerchantEnrichment(row) }
    const matches = await (await getCollection("products")).find(scraperItemNumberQuery([row.itemno]), { maxTimeMS: 10000 }).limit(2).toArray()
    return NextResponse.json({ ...result, saved: mode === "store", catalogue: matches.length === 1 ? merchantCatalogueFacts(matches[0]) : null,
      merchantPreview: enrichmentMerchantPreview(result.enrichment, matches.length === 1 ? matches[0] : null) }, { headers })
  } catch (error) {
    if (error instanceof ScraperError) return NextResponse.json({ error: error.message, hint: error.hint }, { status: error.status, headers })
    return handleApiError(error, "Merchant enrichment failed")
  }
}
