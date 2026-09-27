import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { withRateLimit } from "@/lib/rate-limit"
import { LUCKY_DRAW_COLLECTIONS, winnerEmailHtml } from "@/lib/lucky-draw"

export const dynamic = "force-dynamic"

/**
 * Sends the winner email for an already-recorded draw. Split out of /draw so a
 * slow SMTP handshake never delays the draw itself. Idempotent: a winner who has
 * already been emailed is not emailed again.
 */
export const POST = withRateLimit(async function POST(request: NextRequest) {
  try {
    const token = new URL(request.url).pathname.split("/").at(-2) || ""
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { winnerId } = await request.json().catch(() => ({ winnerId: null }))
    if (typeof winnerId !== "string" || !winnerId) {
      return NextResponse.json({ error: "winnerId is required" }, { status: 400 })
    }

    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const campaign: any = await campaigns.findOne({ drawToken: token })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const winners = await getCollection(LUCKY_DRAW_COLLECTIONS.WINNERS)
    const winner: any = await winners.findOne({ _id: winnerId as any, campaignId: campaign._id })
    if (!winner) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (winner.emailSent) {
      return NextResponse.json({ success: true, emailSent: true, emailError: null })
    }
    if (!winner.participantEmail) {
      const emailError = "No email address on file"
      await winners.updateOne({ _id: winner._id }, { $set: { emailSent: false, emailError } })
      return NextResponse.json({ success: true, emailSent: false, emailError })
    }

    let emailSent = false
    let emailError: string | null = null
    try {
      const { sendEmail } = await import("@/lib/email")
      await sendEmail({
        to: winner.participantEmail,
        subject: `🎉 You won ${winner.prize} — ${campaign.name}`,
        html: winnerEmailHtml({
          winnerName: winner.participantName,
          prizeName: winner.prize,
          prizeIcon: winner.prizeIcon || "🎁",
          campaignName: campaign.name,
          storeName: campaign.store,
        }),
      })
      emailSent = true
    } catch (err) {
      emailError = err instanceof Error ? err.message : "Failed to send email"
      console.error("[lucky-draw] winner email failed:", emailError)
    }

    await winners.updateOne({ _id: winner._id }, { $set: { emailSent, emailError } })

    return NextResponse.json({ success: true, emailSent, emailError })
  } catch (error) {
    console.error("[lucky-draw][notify]", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
} as any, { windowMs: 60 * 1000, maxRequests: 40, message: "Too many requests, please wait a moment." })
