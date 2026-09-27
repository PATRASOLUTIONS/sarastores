import { NextRequest, NextResponse } from "next/server"
import { getAll, create, update, remove, COLLECTIONS, getCollection, normalizeId, createObjectId } from "@/lib/db-service"
import { toMediaUrl } from "@/lib/media"
import { resolveMediaUrl } from "@/lib/media-store"
import { requireAdmin } from "@/lib/auth"

const COLLECTION = COLLECTIONS.HERO_SLIDES

/**
 * Projects the image blob away in MongoDB and keeps only what is needed to build
 * its media URL, so listing slides never transfers ~15 MB of base64.
 */
const LIGHT_IMAGE_STAGES = [
  {
    $addFields: {
      imageIsData: { $eq: [{ $substrCP: [{ $ifNull: ["$image", ""] }, 0, 5] }, "data:"] },
      imageLen: { $strLenCP: { $ifNull: ["$image", ""] } },
    },
  },
  { $addFields: { image: { $cond: ["$imageIsData", null, "$image"] } } },
]

function withMediaUrls(slides: Record<string, any>[]) {
  return slides.map((slide) => {
    const { imageIsData, imageLen, ...rest } = slide
    const id = slide.id || slide._id?.toString?.()
    return {
      ...rest,
      image: imageIsData ? `/api/media/hero-slide/${id}?v=${imageLen}` : toMediaUrl("hero-slide", id, slide.image),
    }
  })
}

// GET: list all hero slides with caching headers
export async function GET() {
  try {
    const col = await getCollection(COLLECTION)
    const docs = await col
      .aggregate([{ $sort: { order: 1, createdAt: 1 } }, ...LIGHT_IMAGE_STAGES])
      .toArray()
    const slides = withMediaUrls(normalizeId(docs))

    // Create response with cache headers for faster loading
    const response = NextResponse.json(slides)

    // Cache for 5 minutes, allow serving stale content while revalidating
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')

    return response
  } catch (err) {
    console.error('/api/hero-slides GET error', err)
    return NextResponse.json({ error: 'Failed to fetch hero slides' }, { status: 500 })
  }
}

// POST: create a new hero slide
export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()

    // Support both single slide creation and bulk save
    if (body.slides && Array.isArray(body.slides)) {
      // Bulk save replaces every slide, so media URLs must be turned back into
      // the stored image first or the bulk save wipes the images.
      const restored = await Promise.all(
        body.slides.map(async (slide: any) => ({
          ...slide,
          image: await resolveMediaUrl(slide.image),
        })),
      )

      const col = await getCollection(COLLECTION)
      await col.deleteMany({})

      if (restored.length > 0) {
        const slidesWithTimestamps = restored.map((slide: any, index: number) => {
          const { id, _id, ...rest } = slide
          return {
            ...rest,
            order: index,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        })
        await col.insertMany(slidesWithTimestamps)
      }

      const newDocs = await col
        .aggregate([{ $sort: { order: 1 } }, ...LIGHT_IMAGE_STAGES])
        .toArray()
      return NextResponse.json({ success: true, slides: withMediaUrls(normalizeId(newDocs)) })
    }

    // Single slide creation
    const { title, subtitle, cta, link, active, titlePosition, subtitlePosition, buttonPosition } = body
    const image = await resolveMediaUrl(body.image)

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 })
    }

    // Get the current max order
    const col = await getCollection(COLLECTION)
    const maxOrderDoc = await col.find({}).sort({ order: -1 }).limit(1).toArray()
    const maxOrder = maxOrderDoc.length > 0 ? (maxOrderDoc[0].order || 0) + 1 : 0

    const newSlide = {
      title: title || "",
      subtitle: subtitle || "",
      image: image,
      cta: cta || "Shop Now",
      link: link || "/products",
      active: active !== false,
      order: maxOrder,
      titlePosition: titlePosition || "center",
      subtitlePosition: subtitlePosition || "center",
      buttonPosition: buttonPosition || "center",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await col.insertOne(newSlide)
    const created = await col.findOne({ _id: result.insertedId })

    return NextResponse.json({
      success: true,
      slide: withMediaUrls([normalizeId(created)])[0],
      message: "Hero slide created successfully"
    })
  } catch (err) {
    console.error('/api/hero-slides POST error', err)
    return NextResponse.json({ error: 'Failed to create hero slide' }, { status: 500 })
  }
}

// PUT: update a hero slide by id (passed in body)
export async function PUT(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const body = await request.json()
    const { id, ...updateData } = body

    if (!id) {
      return NextResponse.json({ error: 'Slide ID is required' }, { status: 400 })
    }

    const col = await getCollection(COLLECTION)
    if ("image" in updateData) {
      updateData.image = await resolveMediaUrl(updateData.image)
    }
    const result = await col.updateOne(
      { _id: createObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 })
    }

    const updated = await col.findOne({ _id: createObjectId(id) })

    return NextResponse.json({
      success: true,
      slide: withMediaUrls([normalizeId(updated)])[0],
      message: "Hero slide updated successfully"
    })
  } catch (err) {
    console.error('/api/hero-slides PUT error', err)
    return NextResponse.json({ error: 'Failed to update hero slide' }, { status: 500 })
  }
}

// DELETE: delete a hero slide by id (query param)
export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) return guard.response

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const col = await getCollection(COLLECTION)
    const result = await col.deleteOne({ _id: createObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Slide not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Hero slide deleted successfully" })
  } catch (err) {
    console.error('/api/hero-slides DELETE error', err)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
