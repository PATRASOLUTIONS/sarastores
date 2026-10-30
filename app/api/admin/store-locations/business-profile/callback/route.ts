import { timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { BUSINESS_OAUTH_STATES, BUSINESS_PROFILE_PAGE, BUSINESS_PROFILE_STATE_COOKIE, businessStateHash, BusinessProfileError,
  finishBusinessConnection, type BusinessProfileOAuthState } from "@/lib/google-business-profile-auth"

export const maxDuration = 45

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  const back = new URL(BUSINESS_PROFILE_PAGE, request.nextUrl.origin)
  try {
    const state = request.nextUrl.searchParams.get("state") || ""
    const cookie = request.cookies.get(BUSINESS_PROFILE_STATE_COOKIE)?.value || ""
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || cookie.length !== state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(cookie))) {
      throw new BusinessProfileError("Google connection verification failed. Start the connection again.", 400, "INVALID_STATE")
    }
    const record = await (await getCollection<BusinessProfileOAuthState>(BUSINESS_OAUTH_STATES)).findOneAndDelete({
      _id: businessStateHash(state), ownerId: guard.userId, expiresAt: { $gt: new Date() },
    })
    if (!record) throw new BusinessProfileError("The Google connection request expired. Start again.", 400, "EXPIRED_STATE")
    if (request.nextUrl.searchParams.has("error")) throw new BusinessProfileError("Google connection was cancelled or permission was not granted.", 400, "ACCESS_DENIED")
    const code = request.nextUrl.searchParams.get("code")
    if (!code || code.length > 4096) throw new BusinessProfileError("Google did not return an authorization code. Start again.", 400, "MISSING_CODE")
    await finishBusinessConnection(guard.userId, code, record)
    back.searchParams.set("googleConnection", "connected")
  } catch (error) {
    back.searchParams.set("googleConnection", error instanceof BusinessProfileError ? error.code : "CONNECTION_FAILED")
  }
  const response = NextResponse.redirect(back)
  response.cookies.set(BUSINESS_PROFILE_STATE_COOKIE, "", { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/admin/store-locations/business-profile/callback", maxAge: 0 })
  response.headers.set("Cache-Control", "no-store")
  return response
}
