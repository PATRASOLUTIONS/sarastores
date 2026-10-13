import { type NextRequest, NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { requireAdmin } from "@/lib/auth"
import { LUCKY_DRAW_COLLECTIONS, newId, parseParticipantList, type LuckyDrawCampaign, type LuckyDrawParticipant } from "@/lib/lucky-draw"
import { z } from "zod"

export const dynamic = "force-dynamic"

const MAX_PARTICIPANTS = 20000

const uploadSchema = z.object({
  csv: z.string().max(4_000_000).optional(),
  rows: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().max(30).optional(),
    email: z.string().max(160).optional(),
  })).max(MAX_PARTICIPANTS).optional(),
  replace: z.boolean().optional(),
}).strict()
class ParticipantUpdateError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { id } = await context.params
    if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 })
    let body: unknown
    try { body = await request.json() } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }
    const parsed = uploadSchema.safeParse(body)
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
    if (rows.length > MAX_PARTICIPANTS) {
      return NextResponse.json({ error: `Limit is ${MAX_PARTICIPANTS} rows per upload` }, { status: 400 })
    }
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const result = await session.withTransaction(async () => {
        const campaigns = await getCollection<LuckyDrawCampaign>(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
        // Serializes participant mutations with each other and the prize draw.
        const claimed = await campaigns.updateOne({ _id: id },
          { $inc: { participantsRevision: 1 }, $set: { updatedAt: new Date() } }, { session })
        if (!claimed.matchedCount) throw new ParticipantUpdateError("Campaign not found", 404)
        const participants = await getCollection<LuckyDrawParticipant>(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
        if (parsed.data.replace) await participants.deleteMany({ campaignId: id, wonAt: null }, { session })
        const existing = await participants.find({ campaignId: id }, { session })
          .project({ phone: 1, email: 1, name: 1 }).toArray()
        const seen = new Set(existing.map(p => `${(p.phone || "").trim()}|${(p.email || "").trim().toLowerCase()}|${(p.name || "").trim().toLowerCase()}`))
        const docs: LuckyDrawParticipant[] = []
        let duplicates = 0
        for (const row of rows) {
          const key = `${row.phone}|${row.email}|${row.name.toLowerCase()}`
          if (seen.has(key)) { duplicates++; continue }
          seen.add(key)
          docs.push({
            _id: newId(), campaignId: id, name: row.name, phone: row.phone, email: row.email,
            wonAt: null, createdAt: new Date(),
          })
        }
        if (existing.length + docs.length > MAX_PARTICIPANTS) {
          throw new ParticipantUpdateError(`Limit is ${MAX_PARTICIPANTS} participants per campaign`, 400)
        }
        if (docs.length) await participants.insertMany(docs, { session })
        return { success: true, inserted: docs.length, duplicates, skipped, total: existing.length + docs.length }
      })
      if (!result) throw new Error("Participant upload transaction did not commit")
      return NextResponse.json(result)
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof ParticipantUpdateError) return NextResponse.json({ error: error.message }, { status: error.status })
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
    if (!/^[a-f0-9]{24}$/i.test(id) || (participantId !== null && !/^[a-f0-9]{24}$/i.test(participantId))) {
      return NextResponse.json({ error: "Invalid campaign or participant ID" }, { status: 400 })
    }
    const { client } = await connectToDatabase()
    const session = client.startSession()
    try {
      const response = await session.withTransaction(async () => {
        const campaigns = await getCollection<LuckyDrawCampaign>(LUCKY_DRAW_COLLECTIONS.CAMPAIGNS)
        const claimed = await campaigns.updateOne({ _id: id },
          { $inc: { participantsRevision: 1 }, $set: { updatedAt: new Date() } }, { session })
        if (!claimed.matchedCount) throw new ParticipantUpdateError("Campaign not found", 404)
        const participants = await getCollection<LuckyDrawParticipant>(LUCKY_DRAW_COLLECTIONS.PARTICIPANTS)
        const result = await participants.deleteMany({
          campaignId: id, wonAt: null, ...(participantId ? { _id: participantId } : {}),
        }, { session })
        if (participantId && !result.deletedCount) throw new ParticipantUpdateError("Participant is missing or has already won", 409)
        return { success: true, deleted: result.deletedCount, message: "Removed eligible participants; winner history was preserved" }
      })
      if (!response) throw new Error("Participant deletion transaction did not commit")
      return NextResponse.json(response)
    } finally {
      await session.endSession()
    }
  } catch (error) {
    if (error instanceof ParticipantUpdateError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error("[lucky-draw][participants][DELETE]", error)
    return NextResponse.json({ error: "Failed to remove participants" }, { status: 500 })
  }
}
