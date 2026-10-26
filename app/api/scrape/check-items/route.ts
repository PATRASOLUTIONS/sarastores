import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { existingScraperItemNumbers } from "@/lib/scrapers/item-numbers"
import { MAX_SCRAPER_IMPORT_ROWS, ScraperImportRowSchema } from "@/lib/scrapers/bulk-import"

const schema = z.object({ itemnos: z.array(ScraperImportRowSchema.shape.itemno).min(1).max(MAX_SCRAPER_IMPORT_ROWS) })
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const existing = await existingScraperItemNumbers(parsed.data.itemnos)
    return NextResponse.json({ success: true, existingItemNumbers: [...existing] }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return handleApiError(error, "Could not check existing item numbers") }
}
