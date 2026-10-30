import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { googleBusinessGet } from "@/lib/google-business-profile-api"
import { BusinessProfileError } from "@/lib/google-business-profile-auth"
import { BusinessProfileMediaSchema, BusinessProfileReviewSchema, GoogleBusinessAccountName, GoogleBusinessConnectionId, GoogleBusinessLocationName } from "@/lib/google-business-profile-types"

const querySchema = z.object({ connectionId: GoogleBusinessConnectionId, account: GoogleBusinessAccountName, location: GoogleBusinessLocationName,
  kind: z.enum(["reviews", "media", "customer-media"]), pageToken: z.string().max(8192).optional() }).strict()
export const maxDuration = 45

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid Google location data request." }, { status: 400 })
  try {
    const { connectionId, account, location, kind, pageToken } = parsed.data
    const path = kind === "reviews" ? "reviews" : kind === "customer-media" ? "media/customers" : "media"
    const url = new URL(`https://mybusiness.googleapis.com/v4/${account}/${location}/${path}`)
    url.searchParams.set("pageSize", kind === "reviews" ? "50" : "100")
    if (pageToken) url.searchParams.set("pageToken", pageToken)
    if (kind === "reviews") {
      const data = await googleBusinessGet(guard.userId, connectionId, url, z.object({ reviews: z.array(BusinessProfileReviewSchema).optional(),
        averageRating: z.number().optional(), totalReviewCount: z.number().optional(), nextPageToken: z.string().optional() }))
      return NextResponse.json({ success: true, ...data, reviews: data.reviews || [] }, { headers: { "Cache-Control": "private, no-store" } })
    }
    const data = await googleBusinessGet(guard.userId, connectionId, url, z.object({ mediaItems: z.array(BusinessProfileMediaSchema).optional(),
      totalMediaItemCount: z.number().optional(), nextPageToken: z.string().optional() }))
    return NextResponse.json({ success: true, ...data, mediaItems: data.mediaItems || [] }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return NextResponse.json({ error: error instanceof BusinessProfileError ? error.message : "Unable to fetch Google photos or reviews." }, { status: error instanceof BusinessProfileError ? error.status : 503 }) }
}
