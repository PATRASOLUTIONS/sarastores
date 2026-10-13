import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { withRateLimit } from "@/lib/rate-limit"
import { connectToDatabase } from "@/lib/mongodb"
import { z } from "zod"
import {
  LUCKY_DRAW_COLLECTIONS,
  maskPhone,
  newId,
  pickRandom,
  type LuckyDrawCampaign,
  type LuckyDrawParticipant,
  type LuckyDrawWinner,
} from "@/lib/lucky-draw"

export const dynamic = "force-dynamic"

class DrawConflict extends Error {}
const drawSchema = z.object({ requestId: z.string().uuid().optional() }).strict()

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

    const rawBody = await request.text()
    let body: unknown = {}
    try { if (rawBody) body = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const parsed = drawSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid draw request" }, { status: 400 })
    const drawRequestId = parsed.data.requestId

    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
    return await session.withTransaction(async () => {
    const campaigns = await getCollection<LuckyDrawCampaign>(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const campaign = await campaigns.findOne({ drawToken: token }, { session })
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const participants = await getCollection<LuckyDrawParticipant>(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
    const winners = await getCollection<LuckyDrawWinner>(LUCKY_DRAW_COLLECTIONS.WINNERS)
    const responseForWinner = async (winner: LuckyDrawWinner) => {
      const remaining = await participants.countDocuments({ campaignId: campaign._id, wonAt: null }, { session })
      const updatedCampaign = await campaigns.findOne({ _id: campaign._id }, { session })
      if (!updatedCampaign) throw new DrawConflict("Campaign is no longer available")
      const prizesLeft = updatedCampaign.prizes.reduce((s, p) => s + (Number(p.quantity) || 0), 0)
      return NextResponse.json({
        success: true,
        winnerId: winner._id,
        winner: { name: winner.participantName, phone: maskPhone(winner.participantPhone), email: winner.participantEmail },
        prize: { name: winner.prize, icon: winner.prizeIcon },
        stats: { remainingParticipants: remaining, prizesLeft },
      })
    }
    if (drawRequestId) {
      const previous = await winners.findOne({ campaignId: campaign._id, drawRequestId }, { session })
      if (previous) return responseForWinner(previous)
    }

    if (campaign.status !== "active") {
      return NextResponse.json(
        { error: `This draw is ${campaign.status}. Set it to active in the admin panel.` },
        { status: 409 },
      )
    }

    const availablePrizes = (campaign.prizes || []).filter((p) => Number(p.quantity) > 0)
    if (availablePrizes.length === 0) {
      return NextResponse.json({ error: "All prizes have been won" }, { status: 409 })
    }

    const pool = await participants
      .find({ campaignId: campaign._id, wonAt: null }, { session })
      .project({ name: 1, phone: 1, email: 1 })
      .toArray()

    if (pool.length === 0) {
      return NextResponse.json({ error: "No participants left to draw" }, { status: 409 })
    }

    const chosen = pickRandom(pool)
    const prize = pickRandom(availablePrizes)
    if (!chosen || !prize) {
      return NextResponse.json({ error: "No participants or prizes left to draw" }, { status: 409 })
    }

    // Reserve the participant first; if another screen took them, ask the client to retry.
    const reserved = await participants.findOneAndUpdate(
      { _id: chosen._id, wonAt: null },
      { $set: { wonAt: new Date() } },
      { session },
    )
    if (!reserved) {
      return NextResponse.json({ error: "Please shake again" }, { status: 409 })
    }

    // Decrement the prize only while stock remains, so quantity cannot go negative.
    const prizeTaken = await campaigns.updateOne(
      { _id: campaign._id, drawToken: token, status: "active", prizes: { $elemMatch: { name: prize.name, quantity: { $gt: 0 } } } },
      { $inc: { "prizes.$.quantity": -1 }, $set: { updatedAt: new Date() } },
      { session },
    )
    if (prizeTaken.modifiedCount === 0) {
      throw new DrawConflict("Please shake again")
    }

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
      ...(drawRequestId ? { drawRequestId } : {}),
    }
    await winners.insertOne(winnerDoc, { session })

    return responseForWinner(winnerDoc)
    })
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof DrawConflict) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error("[lucky-draw][draw]", error)
    return NextResponse.json({ error: "Draw failed" }, { status: 500 })
  }
}, { windowMs: 60 * 1000, maxRequests: 30, message: "Too many draws, please wait a moment." })
