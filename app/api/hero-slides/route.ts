import { NextRequest, NextResponse } from "next/server"
import { ObjectId, type WithId } from "mongodb"
import { z } from "zod"
import { COLLECTIONS, getCollection, normalizeId, type NormalizedDocument } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { toMediaUrl, isMediaUrl } from "@/lib/media"
import { resolveMediaUrl } from "@/lib/media-store"
import { requireAdmin } from "@/lib/auth"
import { heroSlideFieldsSchema, heroSlideMutationSchema } from "@/lib/hero-slides"
import { handleApiError } from "@/lib/api-error"

const COLLECTION = COLLECTIONS.HERO_SLIDES
type HeroDocument = z.infer<typeof heroSlideFieldsSchema> & { createdAt: Date; updatedAt: Date }
type HeroProjection = Omit<HeroDocument, "image"> & { image: string | null; imageIsData?: boolean; imageLen?: number }
const bulkSchema = z.object({ slides: z.array(heroSlideMutationSchema).max(100) }).strict()
  .refine(value => {
    const ids = value.slides.flatMap(slide => slide.id ? [slide.id.toLowerCase()] : [])
    return new Set(ids).size === ids.length
  }, "Duplicate slide IDs")

const LIGHT_IMAGE_STAGES = [
  { $addFields: {
    imageIsData: { $eq: [{ $substrCP: [{ $ifNull: ["$image", ""] }, 0, 5] }, "data:"] },
    imageLen: { $strLenCP: { $ifNull: ["$image", ""] } },
  } },
  { $addFields: { image: { $cond: ["$imageIsData", null, "$image"] } } },
]

function withMediaUrls(slides: NormalizedDocument<HeroProjection>[]) {
  return slides.map(({ imageIsData, imageLen, ...slide }) => ({
    ...slide,
    image: imageIsData ? `/api/media/hero-slide/${slide.id}?v=${imageLen}` : toMediaUrl("hero-slide", slide.id, slide.image),
  }))
}

async function readBody(request: Request): Promise<unknown> {
  try { return await request.json() } catch { return null }
}

class SlideImageError extends Error {}
async function restoredImage(value: string | undefined): Promise<string> {
  const image = await resolveMediaUrl(value)
  if (typeof image !== "string" || !image || isMediaUrl(image)) {
    throw new SlideImageError("Slide image is missing or its stored media could not be resolved")
  }
  return image
}

function errorResponse(error: unknown) {
  if (error instanceof SlideImageError) return NextResponse.json({ error: error.message }, { status: 422 })
  return handleApiError(error, "Failed to save hero slides")
}

export async function GET() {
  try {
    const col = await getCollection<HeroDocument>(COLLECTION)
    const docs = await col.aggregate<WithId<HeroProjection>>([
      { $sort: { order: 1, createdAt: 1 } }, ...LIGHT_IMAGE_STAGES,
    ]).toArray()
    return NextResponse.json(withMediaUrls(normalizeId(docs)), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    })
  } catch (error) {
    return handleApiError(error, "Failed to fetch hero slides")
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const body = await readBody(request)
    const bulk = bulkSchema.safeParse(body)
    if (bulk.success) {
      const now = new Date()
      const restored = await Promise.all(bulk.data.slides.map(async (slide, index) => ({
        ...heroSlideFieldsSchema.partial().parse(slide),
        _id: slide.id ? new ObjectId(slide.id) : new ObjectId(),
        image: await restoredImage(slide.image),
        order: index, createdAt: now, updatedAt: now,
      })))
      const { client, db } = await connectToDatabase()
      const session = client.startSession()
      try {
        const slides = await session.withTransaction(async () => {
          const col = db.collection<Partial<HeroDocument>>(COLLECTION)
          await col.deleteMany({}, { session })
          if (restored.length) await col.insertMany(restored, { session })
          return col.aggregate<WithId<HeroProjection>>([
            { $sort: { order: 1 } }, ...LIGHT_IMAGE_STAGES,
          ], { session }).toArray()
        })
        return NextResponse.json({ success: true, slides: withMediaUrls(normalizeId(slides)) })
      } finally {
        await session.endSession()
      }
    }
    const parsed = heroSlideMutationSchema.safeParse(body)
    if (!parsed.success || !parsed.data.image) return NextResponse.json({ error: "Invalid slide input; an image is required" }, { status: 400 })
    const fields = heroSlideFieldsSchema.partial().parse(parsed.data)
    const image = await restoredImage(fields.image)
    const col = await getCollection<HeroDocument>(COLLECTION)
    const latest = await col.find({}).sort({ order: -1 }).limit(1).toArray()
    const lastOrder = latest[0]?.order ?? -1
    if (!Number.isFinite(lastOrder)) throw new Error("Stored slide order is invalid")
    const now = new Date()
    const newSlide: HeroDocument = {
      title: fields.title || "", subtitle: fields.subtitle || "", image,
      cta: fields.cta || "Shop Now", link: fields.link || "/products", active: fields.active !== false,
      order: lastOrder + 1, titlePosition: fields.titlePosition || "center",
      subtitlePosition: fields.subtitlePosition || "center", buttonPosition: fields.buttonPosition || "center",
      createdAt: now, updatedAt: now,
    }
    const result = await col.insertOne(newSlide)
    return NextResponse.json({
      success: true, slide: withMediaUrls([normalizeId({ ...newSlide, _id: result.insertedId })])[0],
      message: "Hero slide created successfully",
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const parsed = heroSlideMutationSchema.safeParse(await readBody(request))
    if (!parsed.success || !parsed.data.id) return NextResponse.json({ error: "Invalid slide input or ID" }, { status: 400 })
    const update = heroSlideFieldsSchema.partial().parse(parsed.data)
    if (update.image !== undefined) update.image = await restoredImage(update.image)
    const col = await getCollection<HeroDocument>(COLLECTION)
    const updated = await col.findOneAndUpdate(
      { _id: new ObjectId(parsed.data.id) },
      { $set: { ...update, updatedAt: new Date() } },
      { returnDocument: "after" },
    )
    if (!updated) return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    return NextResponse.json({
      success: true, slide: withMediaUrls([normalizeId(updated)])[0], message: "Hero slide updated successfully",
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response
  try {
    const id = new URL(request.url).searchParams.get("id")
    if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid slide ID" }, { status: 400 })
    const col = await getCollection<HeroDocument>(COLLECTION)
    const result = await col.deleteOne({ _id: new ObjectId(id) })
    if (!result.deletedCount) return NextResponse.json({ error: "Slide not found" }, { status: 404 })
    return NextResponse.json({ success: true, message: "Hero slide deleted successfully" })
  } catch (error) {
    return handleApiError(error, "Failed to delete hero slide")
  }
}
