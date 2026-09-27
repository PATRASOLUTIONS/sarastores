import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { LUCKY_DRAW_COLLECTIONS, maskPhone } from "@/lib/lucky-draw"

export const dynamic = "force-dynamic"

/** Public draw-screen state. The token is the only credential. */
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const campaign: any = await campaigns.findOne({ drawToken: token })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const participantsCol = await getCollection(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
    const winnersCol = await getCollection(LUCKY_DRAW_COLLECTIONS.WINNERS)

    const [remaining, total, winners] = await Promise.all([
      participantsCol.countDocuments({ campaignId: campaign._id, wonAt: null }),
      participantsCol.countDocuments({ campaignId: campaign._id }),
      winnersCol.find({ campaignId: campaign._id }).sort({ drawnAt: -1 }).limit(50).toArray(),
    ])

    // Names only — used to animate the shuffle. No contact details leave the server.
    const teaser = await participantsCol
      .find({ campaignId: campaign._id, wonAt: null })
      .project({ name: 1 })
      .limit(60)
      .toArray()

    return NextResponse.json({
      success: true,
      campaign: {
        name: campaign.name,
        store: campaign.store,
        status: campaign.status,
        prizes: (campaign.prizes || []).map((p: any) => ({
          name: p.name,
          icon: p.icon,
          quantity: p.quantity,
        })),
      },
      stats: {
        totalParticipants: total,
        remainingParticipants: remaining,
        prizesLeft: (campaign.prizes || []).reduce((s: number, p: any) => s + (Number(p.quantity) || 0), 0),
      },
      shuffleNames: teaser.map((p: any) => p.name),
      winners: winners.map((w: any) => ({
        name: w.participantName,
        phone: maskPhone(w.participantPhone),
        prize: w.prize,
        prizeIcon: w.prizeIcon,
        drawnAt: w.drawnAt,
      })),
    })
  } catch (error) {
    console.error("[lucky-draw][public GET]", error)
    return NextResponse.json({ error: "Failed to load draw" }, { status: 500 })
  }
}
