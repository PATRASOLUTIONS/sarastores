import { NextResponse } from "next/server"
import sharp from "sharp"
import { requireUser } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { sniffImage } from "@/lib/media-ingest"
import { withRateLimit } from "@/lib/rate-limit"

export const POST = withRateLimit(async (request: Request) => {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const form = await request.formData().catch(() => null)
    const file = form?.get("photo")
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose a photo" }, { status: 400 })
    if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: "Photo must be 2 MB or smaller" }, { status: 400 })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const kind = sniffImage(bytes)
    if (!kind || kind.mime === "image/gif") return NextResponse.json({ error: "Choose a JPEG, PNG or WebP photo" }, { status: 400 })
    let output: Buffer
    try {
      output = await sharp(bytes, { limitInputPixels: 16_000_000 }).rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 80 }).toBuffer()
    } catch (error) {
      console.warn("[Account photo] Invalid image:", error instanceof Error ? error.message : error)
      return NextResponse.json({ error: "Photo could not be processed. Try another image." }, { status: 400 })
    }
    return NextResponse.json({ avatar: `data:image/webp;base64,${output.toString("base64")}` }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) { return handleApiError(error, "Photo upload failed") }
}, { maxRequests: 10, windowMs: 60000 })
