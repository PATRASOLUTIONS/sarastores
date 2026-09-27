import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { LUCKY_DRAW_COLLECTIONS, newDrawToken, normalisePrizes } from "@/lib/lucky-draw"
import { z } from "zod"

export const dynamic = "force-dynamic"

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  store: z.string().min(1).max(160).optional(),
  storeId: z.string().max(64).nullable().optional(),
  prizes: z.array(z.object({
    name: z.string().min(1).max(120),
    icon: z.string().max(16).optional(),
    quantity: z.union([z.number(), z.string()]),
  })).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  regenerateToken: z.boolean().optional(),
})

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const campaign: any = await campaigns.findOne({ _id: id as any })
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const participantsCol = await getCollection(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
    const winnersCol = await getCollection(LUCKY_DRAW_COLLECTIONS.WINNERS)

    const [participants, winners] = await Promise.all([
      participantsCol.find({ campaignId: id }).sort({ createdAt: 1 }).limit(2000).toArray(),
      winnersCol.find({ campaignId: id }).sort({ drawnAt: -1 }).toArray(),
    ])

    return NextResponse.json({
      success: true,
      campaign: { ...campaign, id: campaign._id },
      participants: participants.map((p: any) => ({ ...p, id: p._id })),
      winners: winners.map((w: any) => ({ ...w, id: w._id })),
    })
  } catch (error) {
    console.error("[lucky-draw][GET id]", error)
    return NextResponse.json({ error: "Failed to load campaign" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const parsed = updateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const update: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.name !== undefined) update.name = parsed.data.name.trim()
    if (parsed.data.store !== undefined) update.store = parsed.data.store.trim()
    if (parsed.data.storeId !== undefined) update.storeId = parsed.data.storeId
    if (parsed.data.status !== undefined) update.status = parsed.data.status
    if (parsed.data.prizes !== undefined) {
      const prizes = normalisePrizes(parsed.data.prizes)
      if (prizes.length === 0) {
        return NextResponse.json({ error: "At least one valid prize is required" }, { status: 400 })
      }
      update.prizes = prizes
    }
    if (parsed.data.regenerateToken) update.drawToken = newDrawToken()

    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const result = await campaigns.updateOne({ _id: id as any }, { $set: update })
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const campaign: any = await campaigns.findOne({ _id: id as any })
    return NextResponse.json({ success: true, campaign: { ...campaign, id: campaign._id } })
  } catch (error) {
    console.error("[lucky-draw][PUT]", error)
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const result = await campaigns.deleteOne({ _id: id as any })
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
    }

    const participants = await getCollection(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
    const winners = await getCollection(LUCKY_DRAW_COLLECTIONS.WINNERS)
    await Promise.all([
      participants.deleteMany({ campaignId: id }),
      winners.deleteMany({ campaignId: id }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[lucky-draw][DELETE]", error)
    return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 })
  }
}
