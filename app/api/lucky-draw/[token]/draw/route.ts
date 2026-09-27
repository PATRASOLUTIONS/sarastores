import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { withRateLimit } from "@/lib/rate-limit"
import {
  LUCKY_DRAW_COLLECTIONS,
  maskPhone,
  newId,
  pickRandom,
} from "@/lib/lucky-draw"

export const dynamic = "force-dynamic"

/**
 * Runs one draw. Winner and prize are chosen server-side with a CSPRNG and
 * reserved atomically, so a tampered client cannot influence the outcome or
 * draw the same person twice.
 */
export const POST = withRateLimit(async function POST(
  request: NextRequest,
) {
  try {
    const token = new URL(request.url).pathname.split("/").at(-2) || ""
    if (!/^[a-f0-9]{32}$/.test(token)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const campaign: any = await campaigns.findOne({ drawToken: token })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: `This draw is ${campaign.status}. Set it to active in the admin panel.` },
        { status: 409 },
      )
    }

    const availablePrizes = (campaign.prizes || []).filter((p: any) => Number(p.quantity) > 0)
    if (availablePrizes.length === 0) {
      return NextResponse.json({ error: "All prizes have been won" }, { status: 409 })
    }

    const participants = await getCollection(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
    const pool = await participants
      .find({ campaignId: campaign._id, wonAt: null })
      .project({ name: 1, phone: 1, email: 1 })
      .toArray()

    if (pool.length === 0) {
      return NextResponse.json({ error: "No participants left to draw" }, { status: 409 })
    }

    const chosen: any = pickRandom(pool)
    const prize: any = pickRandom(availablePrizes)

    // Reserve the participant first; if another screen took them, ask the client to retry.
    const reserved = await participants.findOneAndUpdate(
      { _id: chosen._id, wonAt: null },
      { $set: { wonAt: new Date() } },
    )
    if (!reserved) {
      return NextResponse.json({ error: "Please shake again" }, { status: 409 })
    }

    // Decrement the prize only while stock remains, so quantity cannot go negative.
    const prizeTaken = await campaigns.updateOne(
      { _id: campaign._id, prizes: { $elemMatch: { name: prize.name, quantity: { $gt: 0 } } } },
      { $inc: { "prizes.$.quantity": -1 }, $set: { updatedAt: new Date() } },
    )
    if (prizeTaken.modifiedCount === 0) {
      await participants.updateOne({ _id: chosen._id }, { $set: { wonAt: null } })
      return NextResponse.json({ error: "Please shake again" }, { status: 409 })
    }

    const winners = await getCollection(LUCKY_DRAW_COLLECTIONS.WINNERS)
    const winnerDoc = {
      _id: newId(),
      campaignId: campaign._id,
      participantId: chosen._id,
      participantName: chosen.name,
      participantPhone: chosen.phone || "",
      participantEmail: chosen.email || "",
      prize: prize.name,
      prizeIcon: prize.icon || "🎁",
      drawnAt: new Date(),
      drawnBy: "draw-screen",
    }
    await winners.insertOne(winnerDoc as any)

    // The winner email is sent by /notify so a slow SMTP handshake never holds
    // up the draw animation.
    const [remaining, prizesLeft] = await Promise.all([
      participants.countDocuments({ campaignId: campaign._id, wonAt: null }),
      campaigns
        .findOne({ _id: campaign._id })
        .then((c: any) => (c?.prizes || []).reduce((s: number, p: any) => s + (Number(p.quantity) || 0), 0)),
    ])

    return NextResponse.json({
      success: true,
      winnerId: winnerDoc._id,
      winner: {
        name: chosen.name,
        phone: maskPhone(chosen.phone),
        email: chosen.email || "",
      },
      prize: { name: prize.name, icon: prize.icon || "🎁" },
      stats: { remainingParticipants: remaining, prizesLeft },
    })
  } catch (error) {
    console.error("[lucky-draw][draw]", error)
    return NextResponse.json({ error: "Draw failed" }, { status: 500 })
  }
} as any, { windowMs: 60 * 1000, maxRequests: 30, message: "Too many draws, please wait a moment." })
