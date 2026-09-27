import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import {
  LUCKY_DRAW_COLLECTIONS,
  newDrawToken,
  newId,
  normalisePrizes,
} from "@/lib/lucky-draw"
import { z } from "zod"

export const dynamic = "force-dynamic"

const createSchema = z.object({
  name: z.string().min(1).max(120),
  store: z.string().min(1).max(160),
  storeId: z.string().max(64).optional().nullable(),
  prizes: z.array(z.object({
    name: z.string().min(1).max(120),
    icon: z.string().max(16).optional(),
    quantity: z.union([z.number(), z.string()]),
  })).min(1, "At least one prize is required"),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
})

export async function GET() {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const participants = await getCollection(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
    const winners = await getCollection(LUCKY_DRAW_COLLECTIONS.WINNERS)

    const docs = await campaigns.find({}).sort({ createdAt: -1 }).toArray()

    const enriched = await Promise.all(
      docs.map(async (c: any) => ({
        ...c,
        id: c._id,
        participantCount: await participants.countDocuments({ campaignId: c._id }),
        winnerCount: await winners.countDocuments({ campaignId: c._id }),
      })),
    )

    return NextResponse.json({ success: true, campaigns: enriched })
  } catch (error) {
    console.error("[lucky-draw][GET]", error)
    return NextResponse.json({ error: "Failed to load campaigns" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = createSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const prizes = normalisePrizes(parsed.data.prizes)
    if (prizes.length === 0) {
      return NextResponse.json({ error: "At least one valid prize is required" }, { status: 400 })
    }

    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const now = new Date()
    const doc = {
      _id: newId() as any,
      name: parsed.data.name.trim(),
      store: parsed.data.store.trim(),
      storeId: parsed.data.storeId ?? null,
      prizes,
      status: parsed.data.status ?? "draft",
      drawToken: newDrawToken(),
      createdAt: now,
      updatedAt: now,
    }

    await campaigns.insertOne(doc)

    return NextResponse.json({ success: true, campaign: { ...doc, id: doc._id } })
  } catch (error) {
    console.error("[lucky-draw][POST]", error)
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
  }
}
