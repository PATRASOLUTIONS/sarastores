import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/auth"
import { getCollection, normalizeId, createObjectId } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"

const COLLECTION = "listing_banners"

const PLACEMENTS = [
  "hero",
  "promo",
  "home-hero",
  "home-strip",
  "home-duo",
  "home-card",
  "home-statement",
  "pdp-offer",
  "pdp-rail",
  "brands-hero",
] as const

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a #rrggbb colour")

const BannerSchema = z.object({
  placement: z.enum(PLACEMENTS),
  // Empty scope = shown on every listing page. Otherwise matched against the
  // selected category / sub-category label, case-insensitively.
  scope: z.string().max(120).optional().default(""),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional().default(""),
  script: z.string().max(120).optional().default(""),
  ctaText: z.string().max(60).optional().default(""),
  ctaLink: z.string().max(300).optional().default(""),
  image: z.string().max(600).optional().default(""),
  bgFrom: hexColor.optional().default("#1560BD"),
  bgTo: hexColor.optional().default("#0B3C87"),
  accent: hexColor.optional().default("#E11D2E"),
  dark: z.boolean().optional().default(false),
  bullets: z.array(z.string().max(60)).max(6).optional().default([]),
  order: z.number().int().min(0).max(999).optional().default(0),
  active: z.boolean().optional().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const placement = searchParams.get("placement")
    const includeInactive = searchParams.get("all") === "1"

    const filter: Record<string, unknown> = {}
    if (placement && (PLACEMENTS as readonly string[]).includes(placement)) filter.placement = placement
    if (!includeInactive) filter.active = true

    const collection = await getCollection(COLLECTION)
    const docs = await collection.find(filter).sort({ order: 1, createdAt: 1 }).toArray()

    return NextResponse.json(docs.map(normalizeId))
  } catch (error) {
    return handleApiError(error, "Failed to fetch listing banners")
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const parsed = BannerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid banner" }, { status: 400 })
    }

    const collection = await getCollection(COLLECTION)
    const now = new Date()
    const result = await collection.insertOne({ ...parsed.data, createdAt: now, updatedAt: now })

    return NextResponse.json({ id: result.insertedId.toString(), ...parsed.data })
  } catch (error) {
    return handleApiError(error, "Failed to create listing banner")
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const parsed = BannerSchema.partial().safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid banner" }, { status: 400 })
    }

    const collection = await getCollection(COLLECTION)
    const result = await collection.updateOne(
      { _id: createObjectId(id) },
      { $set: { ...parsed.data, updatedAt: new Date() } },
    )
    if (result.matchedCount === 0) return NextResponse.json({ error: "Banner not found" }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to update listing banner")
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const collection = await getCollection(COLLECTION)
    const result = await collection.deleteOne({ _id: createObjectId(id) })
    if (result.deletedCount === 0) return NextResponse.json({ error: "Banner not found" }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error, "Failed to delete listing banner")
  }
}
