/**
 * DELETE /api/v1/account — permanent account deletion.
 *
 * Required by Apple App Store Guideline 5.1.1(v): any app that lets a user
 * create an account must let them delete it from inside the app.
 *
 * Orders and payments are deliberately retained. Indian GST rules require
 * invoice records to be kept for 72 months, so they are lawful-basis retention
 * rather than something the user can erase. Everything that is not legally
 * required is deleted, and the user record itself is anonymised so the retained
 * invoices no longer resolve to a living identity.
 */

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { getSession } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { revokeAllForUser } from "@/lib/refresh-tokens"

export const dynamic = "force-dynamic"

/** Personal data with no retention requirement. */
const PURGE_BY_USER_ID = [
  "carts",
  "wishlists",
  "compare",
  "customer_profiles",
  "customer_events",
  "device_tokens",
  "recently_viewed",
]

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const password = typeof body?.password === "string" ? body.password : ""
    const userId = session.user.id

    if (!ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid account" }, { status: 400 })
    }

    const { db } = await connectToDatabase()
    const users = db.collection("users")
    const user = await users.findOne({ _id: new ObjectId(userId) })
    if (!user || user.status === "deleted") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    // Accounts with a password must re-enter it; a stolen access token alone
    // must not be enough to destroy an account. Google-only accounts have no
    // password to check, and holding a valid session already proves control.
    if (user.password) {
      if (!password) {
        return NextResponse.json({ error: "Password confirmation is required" }, { status: 400 })
      }
      const valid = await bcrypt.compare(password, user.password)
      if (!valid) {
        return NextResponse.json({ error: "Password is incorrect" }, { status: 401 })
      }
    }

    const purged: Record<string, number> = {}
    for (const name of PURGE_BY_USER_ID) {
      try {
        const result = await db.collection(name).deleteMany({ userId })
        if (result.deletedCount) purged[name] = result.deletedCount
      } catch (error) {
        console.warn(`[v1/account] purge failed for ${name}`, error)
      }
    }

    // Reviews stay visible so product ratings remain meaningful, but lose their author.
    try {
      await db.collection("reviews").updateMany(
        { userId },
        { $set: { userName: "Deleted user", userEmail: null, userId: null, anonymisedAt: new Date() } },
      )
    } catch (error) {
      console.warn("[v1/account] review anonymisation failed", error)
    }

    const tombstone = `deleted+${userId}@deleted.invalid`
    await users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          status: "deleted",
          deletedAt: new Date(),
          updatedAt: new Date(),
          email: tombstone,
          name: "Deleted user",
          password: null,
          phone: null,
          address: null,
          avatar: null,
          authProvider: null,
          dashboardAccess: false,
          allowedPages: [],
        },
      },
    )

    const revoked = await revokeAllForUser(userId, "account_deleted")

    const response = NextResponse.json({
      success: true,
      message: "Your account has been deleted.",
      purged,
      sessionsRevoked: revoked,
      retained: "Order and payment records are kept for statutory tax retention and are no longer linked to your identity.",
    })
    response.cookies.set("session", "", { httpOnly: true, path: "/", maxAge: 0 })
    response.cookies.set("user", "", { path: "/", maxAge: 0 })
    return response
  } catch (error) {
    console.error("[v1/account] delete error", error)
    return NextResponse.json({ error: "An error occurred while deleting the account." }, { status: 500 })
  }
}
