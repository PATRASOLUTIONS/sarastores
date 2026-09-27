import { type NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { MEDIA_SOURCES, type MediaType, decodeDataUri } from "@/lib/media"
import { readMediaField } from "@/lib/media-store"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await context.params

  if (!(type in MEDIA_SOURCES)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const stored = await readMediaField(type as MediaType, id)
    if (!stored) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const decoded = decodeDataUri(stored)
    if (!decoded) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const etag = `"${createHash("sha1").update(decoded.body).digest("hex").slice(0, 32)}"`
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } })
    }

    return new NextResponse(new Uint8Array(decoded.body), {
      headers: {
        "Content-Type": decoded.contentType,
        "Content-Length": String(decoded.body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
      },
    })
  } catch (error) {
    console.error("/api/media error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 })
  }
}
