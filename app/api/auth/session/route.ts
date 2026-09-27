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
      // 200 + user:null (instead of 401) so the client can call this endpoint
      // freely during hydration without throwing on a non-OK response, and
      // to make the call safely cacheable as "no logged-in user" without
      // any HTTP caching layer accidentally treating 401 as a permanent state.
      return NextResponse.json({ user: null }, { status: 200 })
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
          { projection: { name: 1, phone: 1, address: 1, avatar: 1, emailVerified: 1, createdAt: 1 } },
        )
        if (doc) {
          profile = {
            name: doc.name || session.user.name,
            phone: doc.phone || "",
            address: doc.address || null,
            avatar: doc.avatar || null,
            emailVerified: !!doc.emailVerified,
            createdAt: doc.createdAt || null,
          }
        }
      }
    } catch (lookupError) {
      // Profile enrichment is best-effort; identity from the token still stands.
      console.warn("[Session] Profile lookup failed", lookupError)
    }

    return NextResponse.json({ user: { ...session.user, ...profile } })
  } catch (error) {
    console.error("Session lookup error:", error)
    return NextResponse.json({ user: null }, { status: 200 })
  }
}