import { NextResponse } from "next/server"
import { getCollection, normalizeId, createObjectId } from "@/lib/db-service"
import { requireAdmin } from "@/lib/auth"
import { z } from "zod"

const componentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("category"),
    title: z.string().trim().max(80).optional().default(""),
    config: z.object({ categoryId: z.string().trim().min(1) }),
    enabled: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  }),
  z.object({
    type: z.literal("manual"),
    title: z.string().trim().min(1).max(80),
    config: z.object({ productIds: z.array(z.string().trim().min(1)).max(30) }),
    enabled: z.boolean().optional(),
    order: z.number().int().min(0).optional(),
  }),
])

// GET: list home components
export async function GET() {
  try {
    const col = await getCollection("home_components")
    const items = await col.find({}).sort({ order: 1 }).toArray()
    return NextResponse.json(normalizeId(items), {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    })
  } catch (err) {
    console.error("/api/home-components GET error", err)
    return NextResponse.json({ error: "Failed to fetch home components" }, { status: 500 })
  }
}

// POST: create a new component
export async function POST(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const col = await getCollection("home_components")
    const parsed = componentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid section", details: parsed.error.flatten() }, { status: 400 })
    }
    const maxOrder = await col.find({}).sort({ order: -1 }).limit(1).next()
    const doc = {
      type: parsed.data.type,
      title: parsed.data.title || null,
      config: parsed.data.config,
      enabled: parsed.data.enabled ?? true,
      order: parsed.data.order ?? (typeof maxOrder?.order === "number" ? maxOrder.order + 1 : 0),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const result = await col.insertOne(doc)
    return NextResponse.json({ success: true, id: result.insertedId.toString(), component: { ...doc, _id: result.insertedId } })
  } catch (err) {
    console.error("/api/home-components POST error", err)
    return NextResponse.json({ error: "Failed to create component" }, { status: 500 })
  }
}

// PUT: update component by id (query param `id`)
export async function PUT(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const body = await request.json()
    const col = await getCollection("home_components")
    const existing = await col.findOne({ _id: createObjectId(id) })
    if (!existing) return NextResponse.json({ error: "Section not found" }, { status: 404 })
    const candidate = {
      type: body.type ?? existing.type,
      title: body.title ?? existing.title ?? "",
      config: body.config ?? existing.config,
      enabled: body.enabled ?? existing.enabled ?? true,
      order: body.order ?? existing.order ?? 0,
    }
    const parsed = componentSchema.safeParse(candidate)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid section", details: parsed.error.flatten() }, { status: 400 })
    }
    const updateData = {
      ...parsed.data,
      title: parsed.data.title || null,
      updatedAt: new Date(),
    }
    await col.updateOne({ _id: createObjectId(id) }, { $set: updateData })
    const updated = await col.findOne({ _id: createObjectId(id) })
    return NextResponse.json({ success: true, component: normalizeId(updated) })
  } catch (err) {
    console.error("/api/home-components PUT error", err)
    return NextResponse.json({ error: "Failed to update component" }, { status: 500 })
  }
}

// DELETE: remove component by id (query param `id`)
export async function DELETE(request: Request) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
    const col = await getCollection("home_components")
    await col.deleteOne({ _id: createObjectId(id) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("/api/home-components DELETE error", err)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
