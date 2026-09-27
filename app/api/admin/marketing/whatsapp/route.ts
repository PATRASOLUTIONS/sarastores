import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth"
import { TEMPLATE_BY_ID } from "@/lib/marketing/campaigns"
import { buildAudience, filterBySegment } from "@/lib/marketing/segments"
import { planCampaign, sendPlannedMessage } from "@/lib/marketing/whatsapp"

export const dynamic = "force-dynamic"

/**
 * Resolves a WhatsApp campaign into the exact AskEva payloads it would produce.
 *
 * Sending requires BOTH `WHATSAPP_CAMPAIGNS_ENABLED=true` in the environment and
 * `confirm: true` in the body. Without both this only ever returns a plan, because
 * a WhatsApp blast cannot be recalled once it leaves.
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json().catch(() => ({}))
    const templateId = String(body?.templateId || "")
    const segment = String(body?.segment || "all")
    const recipientIds: string[] | null = Array.isArray(body?.recipientIds) ? body.recipientIds : null
    const requireConsent = body?.requireConsent !== false
    const confirm = body?.confirm === true
    const limit = Math.min(Math.max(Number(body?.limit) || 200, 1), 2000)

    const template = TEMPLATE_BY_ID[templateId]
    if (!template) {
      return NextResponse.json({ error: "Unknown templateId" }, { status: 400 })
    }

    const all = await buildAudience()
    let audience = filterBySegment(all, segment)
    if (recipientIds && recipientIds.length > 0) {
      const wanted = new Set(recipientIds)
      audience = audience.filter((r) => wanted.has(r.id))
    }

    const plan = planCampaign(template, audience, { requireConsent })

    if (!confirm || plan.dryRun || !plan.configured) {
      return NextResponse.json({
        success: true,
        mode: "dry-run",
        message: plan.dryRun
          ? "Dry run — nothing was sent. Set WHATSAPP_CAMPAIGNS_ENABLED=true and pass confirm:true to send."
          : "Preview only — pass confirm:true to send.",
        ...plan,
        planned: plan.planned.slice(0, limit),
        plannedTotal: plan.planned.length,
      })
    }

    const results: Array<{ to: string; ok: boolean; error?: string }> = []
    for (const message of plan.planned.slice(0, limit)) {
      const res = await sendPlannedMessage(message)
      results.push({ to: message.to, ok: res.ok, error: res.error })
    }

    return NextResponse.json({
      success: true,
      mode: "sent",
      attempted: results.length,
      delivered: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    })
  } catch (error) {
    console.error("[admin/marketing/whatsapp]", error)
    return NextResponse.json({ error: "Failed to plan WhatsApp campaign" }, { status: 500 })
  }
}
