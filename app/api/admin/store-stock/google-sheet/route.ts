import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { readPriceSpreadsheet, googleSheetExportUrl, fetchGoogleSheet, readBoundedSheet } from "@/lib/product-price-import"

const requestSchema = z.object({ sheetId: z.string().trim().min(1).max(2048) }).strict()

// POST - download a stock sheet from Google Sheets and return its rows; saving goes through /api/admin/store-stock
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ success: false, message: "A valid Google Sheet URL or ID is required" }, { status: 400 })
    const url = googleSheetExportUrl(parsed.data.sheetId)
    if (!url) return NextResponse.json({ success: false, message: "Use a valid HTTPS Google Sheet URL or sheet ID" }, { status: 400 })
    const response = await fetchGoogleSheet(url)
    if (!response.ok) {
      await response.body?.cancel()
      return NextResponse.json({ success: false, message: "Google Sheet could not be downloaded; share it as \"Anyone with the link can view\"" }, { status: response.status === 404 ? 404 : 502 })
    }
    try {
      const rows = readPriceSpreadsheet(await readBoundedSheet(response))
      return NextResponse.json({ success: true, rows })
    } catch (error) {
      return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Invalid Google Sheet" }, { status: 400 })
    }
  } catch (error) {
    return handleApiError(error, "Failed to fetch Google Sheet")
  }
}
