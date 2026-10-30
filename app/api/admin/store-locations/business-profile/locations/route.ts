import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { googleBusinessGet } from "@/lib/google-business-profile-api"
import { BusinessProfileError } from "@/lib/google-business-profile-auth"
import { BusinessProfileLocationSchema, GoogleBusinessAccountName, GoogleBusinessConnectionId } from "@/lib/google-business-profile-types"

const querySchema = z.object({ connectionId: GoogleBusinessConnectionId, account: GoogleBusinessAccountName, pageToken: z.string().max(8192).optional() }).strict()
export const maxDuration = 45

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid Google location request." }, { status: 400 })
  try {
    const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${parsed.data.account}/locations`)
    url.searchParams.set("pageSize", "100")
    url.searchParams.set("readMask", "name,title,storeCode,languageCode,storefrontAddress,phoneNumbers,websiteUri,regularHours,specialHours,metadata,latlng,categories,profile,openInfo,serviceArea,labels,adWordsLocationExtensions,relationshipData,moreHours,serviceItems")
    if (parsed.data.pageToken) url.searchParams.set("pageToken", parsed.data.pageToken)
    const data = await googleBusinessGet(guard.userId, parsed.data.connectionId, url, z.object({ locations: z.array(BusinessProfileLocationSchema).optional(), nextPageToken: z.string().optional() }))
    return NextResponse.json({ success: true, locations: data.locations || [], nextPageToken: data.nextPageToken }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return NextResponse.json({ error: error instanceof BusinessProfileError ? error.message : "Unable to fetch Google business locations." }, { status: error instanceof BusinessProfileError ? error.status : 503 }) }
}
