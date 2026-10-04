/**
 * DELETE /api/v1/account — permanent account deletion.
 *
 * Satisfies DPDP Act 2023 s.12(3) (right to erasure) and Apple App Store
 * Guideline 5.1.1(v).
 *
 * Order and payment *records* are deliberately retained: s.12(3) itself carves
 * out personal data whose retention is required "for compliance with any law",
 * and the CGST Act requires invoice records to be kept for 72 months. The
 * records therefore survive, but every direct identifier inside them is
 * redacted so a retained invoice no longer resolves to a living individual.
 * Place-of-supply state is kept because GST liability is computed from it.
 */

import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { ObjectId } from "mongodb"
import { getSession } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { revokeAllForUser } from "@/lib/refresh-tokens"
import { withdrawAllOptional } from "@/lib/consent"

export const dynamic = "force-dynamic"

/** Personal data with no statutory retention requirement. */
const PURGE_BY_USER_ID = [
  "carts",
  "wishlists",
  "compare",
  "customer_profiles",
  "customer_events",
  "device_tokens",
  "recently_viewed",
  "leads",
  "complaints",
  "contact_inquiries",
  "notifications",
  "user_addresses",
  "support_tickets",
]

/** Collections keyed by email rather than by user id. */
const PURGE_BY_EMAIL = ["leads", "contact_inquiries", "newsletter_subscribers"]

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

    const tombstone = `deleted+${userId}@deleted.invalid`

    const purged: Record<string, number> = {}
    for (const name of PURGE_BY_USER_ID) {
      try {
        const result = await db.collection(name).deleteMany({ userId })
        if (result.deletedCount) purged[name] = result.deletedCount
      } catch (error) {
        console.warn(`[v1/account] purge failed for ${name}`, error)
      }
    }

    // Several intake collections (lead forms, contact forms) are filled in
    // before login and so carry only an email address.
    if (typeof user.email === "string" && user.email) {
      for (const name of PURGE_BY_EMAIL) {
        try {
          const result = await db.collection(name).deleteMany({ email: user.email })
          if (result.deletedCount) purged[name] = (purged[name] || 0) + result.deletedCount
        } catch (error) {
          console.warn(`[v1/account] email purge failed for ${name}`, error)
        }
      }
    }

    // Spin-wheel and lucky-draw entries are sharded per campaign.
    try {
      const collections = await db.listCollections({}, { nameOnly: true }).toArray()
      const gamified = collections
        .map((c) => c.name)
        .filter((n) => /^spin_.*_(participants|otps|visits)$/.test(n) || n === "spinWheelParticipants" || n === "lucky_draw_participants")
      for (const name of gamified) {
        const filter = user.email ? { $or: [{ userId }, { email: user.email }] } : { userId }
        const result = await db.collection(name).deleteMany(filter)
        if (result.deletedCount) purged[name] = result.deletedCount
      }
    } catch (error) {
      console.warn("[v1/account] gamification purge failed", error)
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

    // Orders survive for GST, but are stripped of every direct identifier.
    // `state`/`country` stay because place of supply determines the tax charged.
    let ordersAnonymised = 0
    try {
      const redaction = {
        "customer.firstName": "Deleted",
        "customer.lastName": "user",
        "customer.name": "Deleted user",
        "customer.email": tombstone,
        "customer.phone": null,
        "customer.address": "",
        "customer.city": "",
        "customer.zipCode": "",
        "shippingAddress.name": "Deleted user",
        "shippingAddress.street": "",
        "shippingAddress.address": "",
        "shippingAddress.city": "",
        "shippingAddress.zip": "",
        "shippingAddress.phone": null,
        "shippingAddress.email": null,
        notes: "",
        customerAnonymisedAt: new Date(),
      }
      for (const name of ["orders", "external_orders", "partner_orders"]) {
        try {
          const result = await db.collection(name).updateMany({ userId }, { $set: redaction })
          ordersAnonymised += result.modifiedCount
        } catch {
          /* collection may not exist */
        }
      }
      await db.collection("payments").updateMany(
        { userId },
        { $set: { customerEmail: tombstone, customerPhone: null, customerName: "Deleted user", customerAnonymisedAt: new Date() } },
      )
    } catch (error) {
      console.warn("[v1/account] order anonymisation failed", error)
    }

    // Withdraw every optional consent before the identity goes away, so the
    // ledger shows an explicit end state rather than just stopping.
    try {
      await withdrawAllOptional({
        userId,
        source: "account_deletion",
        request,
      })
    } catch (error) {
      console.warn("[v1/account] consent withdrawal failed", error)
    }

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
          dateOfBirth: null,
          ageVerifiedAdult: null,
          ageVerifiedAt: null,
          googleId: null,
          emailVerificationToken: null,
          resetPasswordToken: null,
        },
      },
    )

    const revoked = await revokeAllForUser(userId, "account_deleted")

    const response = NextResponse.json({
      success: true,
      message: "Your account has been deleted.",
      purged,
      ordersAnonymised,
      sessionsRevoked: revoked,
      retained:
        "Invoice and payment records are kept for 72 months to meet GST record-keeping obligations (DPDP Act s.12(3) legal-compliance exception). Every name, email, phone number and street address inside them has been erased, so they no longer identify you.",
    })
    response.cookies.set("session", "", { httpOnly: true, path: "/", maxAge: 0 })
    response.cookies.set("user", "", { path: "/", maxAge: 0 })
    return response
  } catch (error) {
    console.error("[v1/account] delete error", error)
    return NextResponse.json({ error: "An error occurred while deleting the account." }, { status: 500 })
  }
}
