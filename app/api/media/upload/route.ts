import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { ImageIngestError, ingestImage } from "@/lib/media-ingest"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_BYTES = 15 * 1024 * 1024
const MAX_FILES = 12

/** Uploads product imagery and returns the stored renditions. */
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const form = await request.formData().catch(() => null)
    const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: "Attach at least one image" }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ success: false, error: `At most ${MAX_FILES} images at a time` }, { status: 400 })
    }

    const images = []
    const errors: string[] = []
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: larger than 15 MB`)
        continue
      }
      try {
        images.push(await ingestImage(new Uint8Array(await file.arrayBuffer())))
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof ImageIngestError ? error.message : "could not be processed"}`)
      }
    }

    return NextResponse.json({ success: images.length > 0, images, errors })
  } catch (error: any) {
    console.error("[media/upload] failed:", error)
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 })
  }
}
