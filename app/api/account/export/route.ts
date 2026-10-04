/**
 * GET /api/account/export — Digital Personal Data Protection Act 2023, s.11.
 *
 * Section 11(1) gives a Data Principal the right to obtain (a) a summary of the
 * personal data being processed, (b) the identities of every other Data
 * Fiduciary and Data Processor it has been shared with, together with a
 * description of what was shared, and (c) any other prescribed information.
 *
 * This returns all three in a single machine-readable download so the right can
 * be exercised without a support ticket.
 */

import { NextRequest, NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import { requireUser } from "@/lib/auth"
import { connectToDatabase } from "@/lib/mongodb"
import { getConsentHistory } from "@/lib/consent"
import {
  DATA_RECIPIENTS,
  RETENTION_SCHEDULE,
  PRIVACY_NOTICE_VERSION,
  dpdpConfig,
} from "@/lib/dpdp-config"

export const dynamic = "force-dynamic"

/** Never leave the datastore, whatever else is exported. */
const SECRET_FIELDS = [
  "password",
  "resetPasswordToken",
  "resetPasswordExpires",
  "emailVerificationToken",
  "guestAccessTokenHash",
  "refreshTokenHash",
  "twoFactorSecret",
  "apiKeyHash",
]

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof ObjectId) return value.toString()
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_FIELDS.includes(key)) continue
      out[key] = scrub(val)
    }
    return out
  }
  return value
}

/** Collections holding personal data keyed by user id. */
const BY_USER_ID: Array<{ collection: string; label: string }> = [
  { collection: "orders", label: "Orders you have placed" },
  { collection: "payments", label: "Payment records" },
  { collection: "carts", label: "Current shopping cart" },
  { collection: "wishlists", label: "Wishlist" },
  { collection: "compare", label: "Product comparison list" },
  { collection: "reviews", label: "Product reviews you wrote" },
  { collection: "complaints", label: "Complaints and grievances you raised" },
  { collection: "customer_profiles", label: "Marketing profile derived from your activity" },
  { collection: "customer_events", label: "Activity and messaging log" },
  { collection: "recently_viewed", label: "Recently viewed products" },
  { collection: "device_tokens", label: "Registered devices for push notifications" },
  { collection: "external_orders", label: "Orders placed through a partner storefront" },
]

/** Collections keyed by email because they are filled in before login. */
const BY_EMAIL: Array<{ collection: string; label: string }> = [
  { collection: "leads", label: "Enquiry and callback requests" },
  { collection: "contact_inquiries", label: "Contact form submissions" },
]

export async function GET(_request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  try {
    const userId = guard.user.id
    const { db } = await connectToDatabase()

    const account = ObjectId.isValid(userId)
      ? await db.collection("users").findOne({ _id: new ObjectId(userId) })
      : null

    if (!account || account.status === "deleted") {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    const email = typeof account.email === "string" ? account.email : null

    const data: Record<string, { description: string; records: unknown }> = {}

    for (const { collection, label } of BY_USER_ID) {
      try {
        const records = await db.collection(collection).find({ userId }).limit(5000).toArray()
        if (records.length) data[collection] = { description: label, records: scrub(records) }
      } catch {
        /* collection may not exist in this environment */
      }
    }

    if (email) {
      for (const { collection, label } of BY_EMAIL) {
        try {
          const records = await db.collection(collection).find({ email }).limit(5000).toArray()
          if (records.length) data[collection] = { description: label, records: scrub(records) }
        } catch {
          /* collection may not exist in this environment */
        }
      }
    }

    const consentHistory = await getConsentHistory(userId).catch(() => [])

    const payload = {
      export: {
        generatedAt: new Date().toISOString(),
        generatedFor: email,
        legalBasis:
          "Digital Personal Data Protection Act 2023, section 11 (Right to access information about personal data)",
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        dataFiduciary: {
          name: dpdpConfig.legalEntity,
          registeredAddress: dpdpConfig.registeredAddress,
          grievanceOfficer: dpdpConfig.grievanceOfficer,
        },
      },

      // s.11(1)(a) — summary of the personal data being processed.
      account: scrub(account),
      data,

      // s.8(4) — the consent record we rely on, disclosed to you in full.
      consentHistory: scrub(consentHistory),

      // s.11(1)(b) — identities of recipients and what was shared with them.
      sharedWith: DATA_RECIPIENTS,

      // s.8(7) — how long each category is kept and why.
      retentionSchedule: RETENTION_SCHEDULE,

      yourRights: {
        access: "Section 11 — this export.",
        correction:
          "Section 12(1) — update your details under Account → Profile, or contact the Grievance Officer.",
        erasure: "Section 12(3) — Account → Privacy → Delete my account.",
        withdrawConsent:
          "Section 6(4) — Account → Privacy, or the cookie preferences link in the footer. Withdrawal is as easy as giving consent and does not affect processing already carried out.",
        grievance: `Section 13 — write to ${dpdpConfig.grievanceOfficer.email}. We respond within ${dpdpConfig.grievanceSlaDays} days.`,
        complaintToBoard:
          "Section 13(3) — if you are not satisfied with our response, you may complain to the Data Protection Board of India.",
      },
    }

    const filename = `sara-personal-data-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
      },
    })
  } catch (error) {
    console.error("[account/export] failed", error)
    return NextResponse.json({ error: "Could not generate your data export." }, { status: 500 })
  }
}
