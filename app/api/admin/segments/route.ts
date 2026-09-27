import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { buildAudience, countBySegment, SEGMENTS, SEGMENT_GROUP_LABELS } from "@/lib/marketing/segments"

export const dynamic = "force-dynamic"

/** Segment taxonomy with live counts, used to drive the campaign audience picker. */
export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const audience = await buildAudience()
    const counts = countBySegment(audience)

    const groups = Object.entries(SEGMENT_GROUP_LABELS).map(([group, label]) => ({
      group,
      label,
      segments: SEGMENTS.filter((s) => s.group === group).map((s) => ({
        ...s,
        count: counts[s.key] ?? 0,
      })),
    }))

    return NextResponse.json({
      success: true,
      total: audience.length,
      contactable: {
        email: audience.filter((r) => r.email).length,
        whatsapp: audience.filter((r) => r.phone).length,
        emailOptIn: counts.email_optin ?? 0,
        whatsappOptIn: counts.whatsapp_optin ?? 0,
      },
      groups,
      counts,
    })
  } catch (error) {
    console.error("[admin/segments]", error)
    return NextResponse.json({ error: "Failed to compute segments" }, { status: 500 })
  }
}
