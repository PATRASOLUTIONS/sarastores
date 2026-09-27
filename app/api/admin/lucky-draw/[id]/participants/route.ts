import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { LUCKY_DRAW_COLLECTIONS, newId, parseParticipantList } from "@/lib/lucky-draw"
import { z } from "zod"

export const dynamic = "force-dynamic"

const MAX_PARTICIPANTS = 20000

const uploadSchema = z.object({
  csv: z.string().max(4_000_000).optional(),
  rows: z.array(z.object({
    name: z.string().min(1).max(120),
    phone: z.string().max(30).optional(),
    email: z.string().max(160).optional(),
  })).optional(),
  replace: z.boolean().optional(),
})

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const campaigns = await getCollection(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
    const campaign = await campaigns.findOne({ _id: id as any })
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 })

    const parsed = uploadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    let rows = parsed.data.rows?.map((r) => ({
      name: r.name.trim(),
      phone: (r.phone || "").trim(),
      email: (r.email || "").trim().toLowerCase(),
    })) ?? []
    let skipped = 0

    if (parsed.data.csv) {
      const result = parseParticipantList(parsed.data.csv)
      rows = rows.concat(result.rows)
      skipped = result.skipped
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No usable rows found. Expected name, phone, email." }, { status: 400 })
    }

    const participants = await getCollection(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)

    if (parsed.data.replace) {
      await participants.deleteMany({ campaignId: id })
    }

    const existing = await participants.countDocuments({ campaignId: id })
    if (existing + rows.length > MAX_PARTICIPANTS) {
      return NextResponse.json(
        { error: `Limit is ${MAX_PARTICIPANTS} participants per campaign` },
        { status: 400 },
      )
    }

    // De-duplicate within the upload and against what is already stored.
    const seen = new Set(
      (await participants.find({ campaignId: id }).project({ phone: 1, email: 1, name: 1 }).toArray())
        .map((p: any) => `${(p.phone || "").trim()}|${(p.email || "").trim()}|${(p.name || "").trim().toLowerCase()}`),
    )

    const now = new Date()
    const docs: Record<string, unknown>[] = []
    let duplicates = 0

    for (const row of rows) {
      const key = `${row.phone}|${row.email}|${row.name.toLowerCase()}`
      if (seen.has(key)) {
        duplicates++
        continue
      }
      seen.add(key)
      docs.push({
        _id: newId(),
        campaignId: id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        wonAt: null,
        createdAt: now,
      })
    }

    if (docs.length > 0) await participants.insertMany(docs as any)

    return NextResponse.json({
      success: true,
      inserted: docs.length,
      duplicates,
      skipped,
      total: await participants.countDocuments({ campaignId: id }),
    })
  } catch (error) {
    console.error("[lucky-draw][participants][POST]", error)
    return NextResponse.json({ error: "Failed to upload participants" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    const participantId = new URL(request.url).searchParams.get("participantId")
    const participants = await getCollection(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)

    const filter = participantId ? { campaignId: id, _id: participantId as any } : { campaignId: id }
    const result = await participants.deleteMany(filter)

    return NextResponse.json({ success: true, deleted: result.deletedCount })
  } catch (error) {
    console.error("[lucky-draw][participants][DELETE]", error)
    return NextResponse.json({ error: "Failed to remove participants" }, { status: 500 })
  }
}
