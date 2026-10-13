import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { MAX_PRICE_IMPORT_BYTES, readPriceSpreadsheet, processProductPrices } from "@/lib/product-price-import"

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof Blob)) return NextResponse.json({ error: "No file provided" }, { status: 400 })
    if (file.size > MAX_PRICE_IMPORT_BYTES) return NextResponse.json({ error: "File exceeds 10 MB" }, { status: 413 })
    let rows: Record<string, unknown>[]
    try {
      rows = readPriceSpreadsheet(await file.arrayBuffer())
    } catch (error) {
      console.warn("[Price Import] Invalid spreadsheet", error)
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid spreadsheet" }, { status: 400 })
    }
    return NextResponse.json(await processProductPrices(rows, formData.get("preview") === "true"))
  } catch (error) {
    return handleApiError(error, "Failed to process price update")
  }
}
