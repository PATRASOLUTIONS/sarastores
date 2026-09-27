import { type NextRequest, NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { ReviewSchema } from "@/lib/validation"
import { requireUser } from "@/lib/auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "development") console.log("Fetching reviews from database...")
    const searchParams = request.nextUrl.searchParams
    const productId = searchParams.get("productId")

    let reviews
    if (productId) {
      if (process.env.NODE_ENV === "development") console.log(`Filtering reviews by product ID: ${productId}`)
      const collection = await dbService.getCollection(COLLECTIONS.REVIEWS)
      // Older documents nest the product, newer ones store a flat productId.
      reviews = await collection
        .find({ $or: [{ "product.id": productId }, { productId }] })
        .sort({ createdAt: -1 })
        .toArray()
      reviews = dbService.normalizeId(reviews)
    } else {
      reviews = await dbService.getAll(COLLECTIONS.REVIEWS)
    }

    if (process.env.NODE_ENV === "development") console.log(`Found ${reviews?.length || 0} reviews`)
    return NextResponse.json(reviews || [])
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return handleApiError(error, "Failed to fetch reviews")
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  const limit = await checkRateLimit(request, RATE_LIMITS.REVIEWS)
  if (!limit.success) {
    return NextResponse.json(
      { error: RATE_LIMITS.REVIEWS.message },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 3600) } },
    )
  }

  try {
    const data = await request.json()

    const parsed = ReviewSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { isVerifiedPurchase: _clientClaim, ...input } = parsed.data
    const collection = await dbService.getCollection(COLLECTIONS.REVIEWS)

    // One review per product per customer, so ratings can't be stuffed.
    const existing = await collection.findOne({
      userId: guard.user.id,
      $or: [{ productId: input.productId }, { "product.id": input.productId }],
    })
    if (existing) {
      return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 })
    }

    // The badge is earned from order history, never asserted by the client.
    const orders = await dbService.getCollection("orders")
    const purchased = await orders.findOne({
      userId: guard.user.id,
      "items.id": input.productId,
    })

    const review = await dbService.create(COLLECTIONS.REVIEWS, {
      ...input,
      userId: guard.user.id,
      author: {
        id: guard.user.id,
        name: guard.user.name || guard.user.email?.split("@")[0] || "Customer",
      },
      // Written both ways so the nested-product filter above keeps working.
      product: { id: input.productId },
      isVerifiedPurchase: !!purchased,
      status: "published",
      createdAt: new Date(),
    })

    return NextResponse.json(review)
  } catch (error) {
    console.error("Error creating review:", error)
    return handleApiError(error, "Failed to create review")
  }
}
