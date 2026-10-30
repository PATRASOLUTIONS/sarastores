import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { readPriceSpreadsheet, processProductPrices, googleSheetExportUrl, fetchGoogleSheet, readBoundedSheet } from "@/lib/product-price-import"

const requestSchema = z.object({ sheetId: z.string().trim().min(1).max(2048), preview: z.boolean().default(false) })

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "A valid Sheet ID/URL and boolean preview are required" }, { status: 400 })
    const url = googleSheetExportUrl(parsed.data.sheetId)
    if (!url) return NextResponse.json({ error: "Use a valid HTTPS Google Sheet URL or sheet ID" }, { status: 400 })
    const response = await fetchGoogleSheet(url)
    if (!response.ok) {
      await response.body?.cancel()
      return NextResponse.json({ error: "Google Sheet could not be downloaded; check publication and permissions" }, { status: response.status === 404 ? 404 : 502 })
    }
    let rows: Record<string, unknown>[]
    try {
      rows = readPriceSpreadsheet(await readBoundedSheet(response))
    } catch (error) {
      console.warn("[Price Import] Invalid Google Sheet", error)
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Google Sheet" }, { status: 400 })
    }
    return NextResponse.json(await processProductPrices(rows, parsed.data.preview))
  } catch (error) {
    return handleApiError(error, "Failed to process Google Sheet sync")
  }
}
