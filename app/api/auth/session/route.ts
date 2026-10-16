import { NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { ObjectId } from "mongodb"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const session = await getSession()

    if (!session?.user) {
      // 200 + user:null (instead of 401) so hydration can read "logged out"
      // without the client treating the response as an expired session.
      // private, no-store stops a cached logged-out body from sticking after login.
      return NextResponse.json({ user: null }, { status: 200, headers: { "Cache-Control": "private, no-store" } })
    }

    // The signed token only carries identity + role. Profile fields live in the
    // database, and the client needs them to prefill checkout and the account
    // pages, so they are merged in here rather than bloating the cookie.
    let profile: Record<string, unknown> = {}
    try {
      if (ObjectId.isValid(session.user.id)) {
        const users = await getCollection("users")
        const doc = await users.findOne(
          { _id: new ObjectId(session.user.id) },
          { projection: { name: 1, phone: 1, address: 1, avatar: 1, emailVerified: 1, createdAt: 1, dateOfBirth: 1 } },
        )
        if (doc) {
          profile = {
            name: doc.name || session.user.name,
            phone: doc.phone || "",
            address: doc.address || null,
            avatar: doc.avatar || null,
            emailVerified: !!doc.emailVerified,
            createdAt: doc.createdAt || null,
            dateOfBirth: doc.dateOfBirth || null,
          }
        }
      }
    } catch (lookupError) {
      // Profile enrichment is best-effort; identity from the token still stands.
      console.warn("[Session] Profile lookup failed", lookupError)
    }

    return NextResponse.json(
      { user: { ...session.user, ...profile } },
      { headers: { "Cache-Control": "private, no-store" } },
    )
  } catch (error) {
    // 503, not a logged-out 200. The client treats `{ user: null }` as
    // "this session is gone" and would sign the shopper out.
    console.error("Session lookup error:", error)
    return NextResponse.json(
      { user: null, message: "Session is temporarily unavailable. Please try again." },
      { status: 503 },
    )
  }
}