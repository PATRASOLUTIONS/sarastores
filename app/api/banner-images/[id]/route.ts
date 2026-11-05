import { NextResponse } from "next/server"
import { handleApiError } from "@/lib/api-error"
import { readBannerImage } from "@/lib/banner-images"
import { readBannerImageVariant } from "@/lib/banner-image-variants"
import { BANNER_IMAGE_WIDTHS } from "@/lib/banner-image-sources"

/** Public read of an uploaded banner photo. Ids are content hashes, so the bytes never change. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const requestedWidth = new URL(request.url).searchParams.get("w")
    const width = requestedWidth === null ? null : Number(requestedWidth)
    if (width !== null && (!(BANNER_IMAGE_WIDTHS as readonly number[]).includes(width) || requestedWidth !== String(width))) {
      return NextResponse.json({ error: "Unsupported image width" }, { status: 400 })
    }
    const image = width === null ? await readBannerImage(id) : await readBannerImageVariant(id, width)
    if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 })

    const bytes = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data.buffer)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": image.contentType,
        "Content-Length": String(image.bytes),
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    return handleApiError(error, "Banner image could not be loaded")
  }
}
