import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { requireAdmin } from "@/lib/auth"
import { COLLECTION_CUSTOMER_PROFILES, COLLECTION_CUSTOMER_EVENTS } from "@/lib/customer-profile"
import { getSegmentCounts, SEGMENT_LABELS, SEGMENTS } from "@/lib/retention/segmentation"

export const dynamic = "force-dynamic"

/** Retention health: segment mix, consent reach and recent reminder volume. */
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const profiles = await getCollection(COLLECTION_CUSTOMER_PROFILES)
    const events = await getCollection(COLLECTION_CUSTOMER_EVENTS)

    const [segmentCounts, totalProfiles, emailOptIn, whatsappOptIn] = await Promise.all([
      getSegmentCounts(),
      profiles.countDocuments({}),
      profiles.countDocuments({ "consent.email": true }),
      profiles.countDocuments({ "consent.whatsapp": true }),
    ])

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recentReminders = await events
      .aggregate([
        { $match: { type: "reminder_sent", createdAt: { $gte: thirtyDaysAgo } } },
        { $group: { _id: "$payload.kind", count: { $sum: 1 } } },
      ])
      .toArray()

    const remindersByKind: Record<string, number> = {}
    for (const row of recentReminders) {
      remindersByKind[String(row._id ?? "unknown")] = Number(row.count) || 0
    }

    return NextResponse.json({
      success: true,
      customers: {
        total: totalProfiles,
        emailOptIn,
        whatsappOptIn,
        emailOptInRate: totalProfiles > 0 ? Math.round((emailOptIn / totalProfiles) * 100) : 0,
      },
      segments: SEGMENTS.map((segment) => ({
        key: segment,
        label: SEGMENT_LABELS[segment],
        count: segmentCounts[segment] ?? 0,
      })),
      unsegmented: segmentCounts.unsegmented ?? 0,
      remindersLast30Days: remindersByKind,
    })
  } catch (error) {
    return handleApiError(error, "Failed to load retention overview")
  }
}
