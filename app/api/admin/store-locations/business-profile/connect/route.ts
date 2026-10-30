import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { BUSINESS_OAUTH_STATES, BUSINESS_PROFILE_STATE_COOKIE, BusinessProfileError, createBusinessOAuthState, type BusinessProfileOAuthState } from "@/lib/google-business-profile-auth"

export const maxDuration = 45

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const oauth = createBusinessOAuthState(guard.userId)
    const collection = await getCollection<BusinessProfileOAuthState>(BUSINESS_OAUTH_STATES)
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    await collection.insertOne(oauth.record)
    const response = NextResponse.redirect(oauth.url)
    response.cookies.set(BUSINESS_PROFILE_STATE_COOKIE, oauth.state, { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/admin/store-locations/business-profile/callback", maxAge: 600 })
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof BusinessProfileError ? error.message : "Unable to start the Google Business Profile connection." }, { status: error instanceof BusinessProfileError ? error.status : 503 })
  }
}
