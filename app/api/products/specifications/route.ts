import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Fetching product specifications from product_specifications")

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const search = searchParams.get('search') || ''
    const lightweight = searchParams.get('lightweight') === 'true'
    const syncedParam = searchParams.get('synced') // 'true', 'false', or null/undefined
    const lockedParam = searchParams.get('locked') // 'true', 'false', or null/undefined
    const categoryParam = searchParams.get('category') || ''
    const contentParam = searchParams.get('content') || '' // 'complete' | 'empty' | 'noImages'

    const { db } = await connectToDatabase()
    const specsCollection = db.collection("product_specifications")

    // Build query
    const query: any = {}
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }

    if (lockedParam === 'true') {
      query.locked = true
    } else if (lockedParam === 'false') {
      // Missing means unlocked, so an equality test on `false` would miss rows.
      query.locked = { $ne: true }
    }

    if (categoryParam) {
      query.category = categoryParam
    }

    if (contentParam === 'empty') {
      query.$and = [
        ...(query.$and ?? []),
        {
          $or: [
            { technical_details: { $in: [null, {}] } },
            { technical_details: { $exists: false } },
          ],
        },
      ]
    } else if (contentParam === 'complete') {
      query.technical_details = { $exists: true, $nin: [null, {}] }
    } else if (contentParam === 'noImages') {
      query.$and = [
        ...(query.$and ?? []),
        { $or: [{ specification_images: { $size: 0 } }, { specification_images: { $exists: false } }] },
      ]
    }

    if (syncedParam === 'true') {
      query.isSynced = true
    } else if (syncedParam === 'false') {
      query.isSynced = { $ne: true } // Treat missing or false as not synced

      // Filter pending specs to only show those updated from today onwards
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      query.updatedAt = { $gte: todayStart }
    }

    // Get total count for pagination
    const total = await specsCollection.countDocuments(query)

    // For lightweight mode, only return table fields
    const projection = lightweight ? {
      _id: 1,
      name: 1,
      sku: 1,
      mrp: 1,
      technical_details: 1,
      from_manufacturer: 1,
      specification_images: 1,
      locked: 1,
      updatedAt: 1,
      included_components: 1,
      reviews: 1,
      category: 1,
      subCategory: 1,
      prod_desc: 1,
      group_name: 1,
      char_desc: 1,
      manufacturer_name: 1,
    } : {
      _id: 1,
      name: 1,
      sku: 1,
      description: 1,
      mrp: 1,
      technical_details: 1,
      from_manufacturer: 1,
      specification_images: 1,
      locked: 1,
      updatedAt: 1,
      product_id: 1,
      overview: 1,
      included_components: 1,
      features: 1,
      reviews: 1,
      category: 1,
      subCategory: 1,
      isSynced: 1,
      prod_desc: 1,
      group_name: 1,
      char_desc: 1,
      manufacturer_name: 1,
    }

    // Get paginated results
    const specs = await specsCollection
      .find(query)
      .project(projection)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    if (process.env.NODE_ENV === "development") console.log("ByteWise Testing Point Found specifications in product_specifications:", specs.length)

    return NextResponse.json(
      {
        data: specs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (error) {
    console.error("ByteWise Testing Point Error fetching specifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch specifications", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
