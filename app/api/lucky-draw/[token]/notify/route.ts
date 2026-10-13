import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { withRateLimit } from "@/lib/rate-limit"
import { LUCKY_DRAW_COLLECTIONS, winnerEmailHtml, newId, type LuckyDrawCampaign, type LuckyDrawWinner } from "@/lib/lucky-draw"
import { z } from "zod"

export const dynamic = "force-dynamic"

const notifySchema = z.object({ winnerId: z.string().regex(/^[a-f0-9]{24}$/) }).strict()
const mailAcceptanceSchema = z.object({ accepted: z.array(z.string()).min(1), rejected: z.array(z.string()).optional() })

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

    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const parsed = notifySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid winnerId" }, { status: 400 })
    const { winnerId } = parsed.data

    const campaigns = await getCollection<LuckyDrawCampaign>(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const campaign = await campaigns.findOne({ drawToken: token })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const winners = await getCollection<LuckyDrawWinner>(LUCKY_DRAW_COLLECTIONS.WINNERS)
    const winner = await winners.findOne({ _id: winnerId, campaignId: campaign._id })
    if (!winner) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (winner.emailSent) {
      return NextResponse.json({ success: true, emailSent: true, emailError: null })
    }
    if (winner.emailDeliveryStatus === "sending" || winner.emailDeliveryStatus === "uncertain") {
      return NextResponse.json({ error: "Email delivery is in progress or requires operator reconciliation" }, { status: 409 })
    }
    if (!winner.participantEmail) {
      const emailError = "No email address on file"
      await winners.updateOne({ _id: winner._id }, { $set: { emailSent: false, emailError } })
      return NextResponse.json({ success: true, emailSent: false, emailError })
    }

    const emailSendId = newId()
    const claimed = await winners.findOneAndUpdate(
      { _id: winner._id, campaignId: campaign._id, emailSent: { $ne: true }, emailDeliveryStatus: { $nin: ["sending", "uncertain"] } },
      { $set: { emailDeliveryStatus: "sending", emailSendId, emailClaimedAt: new Date() } },
    )
    if (!claimed) return NextResponse.json({ error: "Notification already claimed; reload its delivery status" }, { status: 409 })

    let emailSent = false
    let emailError: string | null = null
    let emailDeliveryStatus: NonNullable<LuckyDrawWinner["emailDeliveryStatus"]> = "failed"
    try {
      const { sendEmail } = await import("@/lib/email")
      const delivery = await sendEmail({
        to: claimed.participantEmail,
        subject: `🎉 You won ${claimed.prize} — ${campaign.name}`,
        html: winnerEmailHtml({
          winnerName: claimed.participantName,
          prizeName: claimed.prize,
          prizeIcon: claimed.prizeIcon || "🎁",
          campaignName: campaign.name,
          storeName: campaign.store,
        }),
      })
      const acceptance = mailAcceptanceSchema.safeParse(delivery.result)
      if (delivery.success !== true || !acceptance.success ||
        !acceptance.data.accepted.some(address => address.toLowerCase() === claimed.participantEmail.toLowerCase()) ||
        acceptance.data.rejected?.some(address => address.toLowerCase() === claimed.participantEmail.toLowerCase())) {
        console.error("[lucky-draw] winner email was not accepted", delivery.error)
        emailError = "Email acceptance could not be confirmed; operator reconciliation is required"
        emailDeliveryStatus = "uncertain"
      } else {
        emailSent = true
        emailDeliveryStatus = "sent"
      }
    } catch (err) {
      emailError = "Email delivery could not be confirmed; operator reconciliation is required"
      emailDeliveryStatus = "uncertain"
      console.error("[lucky-draw] winner email outcome is uncertain:", err)
    }

    const recorded = await winners.updateOne(
      { _id: winner._id, campaignId: campaign._id, emailSendId },
      { $set: { emailSent, emailError, emailDeliveryStatus } },
    )
    if (recorded.matchedCount !== 1) throw new Error("Winner notification claim changed during delivery")

    return NextResponse.json({ success: true, emailSent, emailError })
  } catch (error) {
    console.error("[lucky-draw][notify]", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}, { windowMs: 60 * 1000, maxRequests: 40, message: "Too many requests, please wait a moment." })
