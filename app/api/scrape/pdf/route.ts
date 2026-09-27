import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { scrapePdf } from "@/lib/scrapers/pdf"
import { ScraperError, SCRAPER_LABELS } from "@/lib/scrapers/types"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 25 * 1024 * 1024

/**
 * Imports a vendor spec sheet or EDM from an uploaded PDF and returns the same
 * normalised `ScrapedProduct` the web scrapers produce.
 *
 * Upload only, deliberately: accepting a URL here would hand an authenticated
 * caller a server-side fetch primitive against arbitrary hosts.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const form = await request.formData().catch(() => null)
    const file = form?.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Attach a PDF file" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, error: "PDF is larger than 25 MB" }, { status: 413 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    // Trust the magic number rather than the client-supplied content type.
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") {
      return NextResponse.json({ success: false, error: "That file is not a PDF" }, { status: 400 })
    }

    const product = await scrapePdf(bytes, file.name || "upload.pdf")

    return NextResponse.json({
      success: true,
      source: "pdf",
      sourceLabel: SCRAPER_LABELS.pdf,
      product,
    })
  } catch (error: any) {
    if (error instanceof ScraperError) {
      return NextResponse.json({ success: false, error: error.message, hint: error.hint }, { status: error.status })
    }
    console.error("[scrape/pdf] failed:", error)
    return NextResponse.json({ success: false, error: error?.message || "Could not read the PDF" }, { status: 500 })
  }
}
