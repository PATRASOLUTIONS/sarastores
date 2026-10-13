import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { MAX_PRICE_IMPORT_BYTES, readPriceSpreadsheet, processProductPrices, googleSheetExportUrl } from "@/lib/product-price-import"

const requestSchema = z.object({ sheetId: z.string().trim().min(1).max(2048), preview: z.boolean().default(false) })

function allowedDownloadUrl(url: URL): boolean {
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    (url.hostname === "docs.google.com" || url.hostname === "drive.google.com" || url.hostname.endsWith(".googleusercontent.com"))
}

async function fetchSheet(url: string): Promise<Response> {
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "manual" })
    if (response.status < 300 || response.status >= 400) return response
    const location = response.headers.get("location")
    await response.body?.cancel()
    if (!location) throw new Error("Google Sheet redirect has no destination")
    const next = new URL(location, url)
    if (!allowedDownloadUrl(next)) throw new Error("Google Sheet redirected outside the allowed download hosts")
    url = next.toString()
  }
  throw new Error("Google Sheet exceeded the redirect limit")
}

async function readBoundedSheet(response: Response): Promise<ArrayBuffer> {
  if (Number(response.headers.get("content-length")) > MAX_PRICE_IMPORT_BYTES) {
    await response.body?.cancel()
    throw new Error("Google Sheet exceeds 10 MB")
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Google Sheet has no response body")
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_PRICE_IMPORT_BYTES) {
        await reader.cancel()
        throw new Error("Google Sheet exceeds 10 MB")
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const buffer = new ArrayBuffer(length)
  const bytes = new Uint8Array(buffer)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return buffer
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "A valid Sheet ID/URL and boolean preview are required" }, { status: 400 })
    const url = googleSheetExportUrl(parsed.data.sheetId)
    if (!url) return NextResponse.json({ error: "Use a valid HTTPS Google Sheet URL or sheet ID" }, { status: 400 })
    const response = await fetchSheet(url)
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
