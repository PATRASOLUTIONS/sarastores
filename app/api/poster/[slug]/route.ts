import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { POSTER_BY_SLUG, renderPosterSvg } from "@/lib/posters"
import { getCustomPoster } from "@/lib/custom-posters"

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const poster = POSTER_BY_SLUG[slug] ?? (await getCustomPoster(slug))

  if (!poster) {
    return NextResponse.json({ error: "Poster not found" }, { status: 404 })
  }

  const svg = renderPosterSvg(poster)
  // Posters are generated from source, so they change on deploy. `immutable`
  // would pin stale artwork in browsers; an ETag revalidates cheaply instead.
  const etag = `W/"${createHash("sha1").update(svg).digest("base64url").slice(0, 20)}"`

  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } })
  }

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      ETag: etag,
    },
  })
}
