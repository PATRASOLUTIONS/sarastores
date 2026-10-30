import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { googleBusinessGet } from "@/lib/google-business-profile-api"
import { BusinessProfileError } from "@/lib/google-business-profile-auth"
import { BusinessProfileAccountSchema, GoogleBusinessAccountName, GoogleBusinessConnectionId } from "@/lib/google-business-profile-types"

const querySchema = z.object({ connectionId: GoogleBusinessConnectionId, parentAccount: GoogleBusinessAccountName.optional(), pageToken: z.string().max(8192).optional() }).strict()
export const maxDuration = 45

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) return NextResponse.json({ error: "Invalid Google account request." }, { status: 400 })
  try {
    const url = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts")
    url.searchParams.set("pageSize", "20")
    if (parsed.data.parentAccount) url.searchParams.set("parentAccount", parsed.data.parentAccount)
    if (parsed.data.pageToken) url.searchParams.set("pageToken", parsed.data.pageToken)
    const data = await googleBusinessGet(guard.userId, parsed.data.connectionId, url, z.object({ accounts: z.array(BusinessProfileAccountSchema).optional(), nextPageToken: z.string().optional() }))
    return NextResponse.json({ success: true, accounts: data.accounts || [], nextPageToken: data.nextPageToken }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return NextResponse.json({ error: error instanceof BusinessProfileError ? error.message : "Unable to fetch Google business accounts." }, { status: error instanceof BusinessProfileError ? error.status : 503 }) }
}
