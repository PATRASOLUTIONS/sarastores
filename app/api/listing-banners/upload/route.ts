import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { handleApiError } from "@/lib/api-error"
import { ImageIngestError } from "@/lib/media-ingest"
import { MAX_BANNER_UPLOAD_BYTES, storeBannerImage } from "@/lib/banner-images"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/** Stores one banner photo in MongoDB and returns the URL to save on the banner. */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const form = await request.formData().catch(() => null)
    const file = form?.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "Choose an image to upload" }, { status: 400 })
    }
    if (file.size > MAX_BANNER_UPLOAD_BYTES) {
      return NextResponse.json({ success: false, error: "Image is larger than 10 MB" }, { status: 413 })
    }

    const image = await storeBannerImage(new Uint8Array(await file.arrayBuffer()))
    return NextResponse.json({ success: true, images: [image] })
  } catch (error) {
    if (error instanceof ImageIngestError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    return handleApiError(error, "Banner image could not be uploaded")
  }
}
