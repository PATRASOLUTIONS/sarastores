import { NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { readBannerImage } from "@/lib/banner-images"

/** Public read of an uploaded banner photo. Ids are content hashes, so the bytes never change. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const image = await readBannerImage(id)
    if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 })

    return new NextResponse(new Uint8Array(image.data.buffer), {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.bytes),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return handleApiError(error, "Banner image could not be loaded")
  }
}
