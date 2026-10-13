import { type NextRequest, NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { ReviewSchema } from "@/lib/validation"
import { requireUser } from "@/lib/auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { MongoServerError, ObjectId } from "mongodb"
import { getReviewProduct, publishedReviewFilter, synchronizeReviewStats, withReviewTransaction, type CustomerReviewDocument } from "@/lib/reviews"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === "development") console.log("Fetching reviews from database...")
    const searchParams = request.nextUrl.searchParams
    const productId = searchParams.get("productId")

    let reviews
    if (productId) {
      if (process.env.NODE_ENV === "development") console.log(`Filtering reviews by product ID: ${productId}`)
      const collection = await dbService.getCollection<CustomerReviewDocument>(COLLECTIONS.REVIEWS)
      // Older documents nest the product, newer ones store a flat productId.
      const product = await getReviewProduct(productId)
      if (!product || product.active === false) return NextResponse.json({ error: "Product not found" }, { status: 404 })
      reviews = await collection
        .find(publishedReviewFilter(String(product.id)))
        .sort({ createdAt: -1 })
        .toArray()
      reviews = dbService.normalizeId(reviews)
    } else {
      reviews = await dbService.getAll<CustomerReviewDocument>(COLLECTIONS.REVIEWS, publishedReviewFilter())
    }

    if (process.env.NODE_ENV === "development") console.log(`Found ${reviews?.length || 0} reviews`)
    return NextResponse.json(reviews || [], { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Error fetching reviews:", error)
    return handleApiError(error, "Failed to fetch reviews")
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response

  try {
    const limit = await checkRateLimit(request, RATE_LIMITS.REVIEWS)
    if (!limit.success) {
      return NextResponse.json(
        { error: RATE_LIMITS.REVIEWS.message },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter ?? 3600) } },
      )
    }
    const data = await request.json()

    const parsed = ReviewSchema.safeParse(data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { isVerifiedPurchase: _clientClaim, orderId: _clientOrder, ...input } = parsed.data
    const product = await getReviewProduct(input.productId)
    if (!product || product.active === false) return NextResponse.json({ error: "Product not found" }, { status: 404 })
    const productId = String(product.id)
    const collection = await dbService.getCollection<CustomerReviewDocument>(COLLECTIONS.REVIEWS)

    // One review per product per customer, so ratings can't be stuffed.
    const existing = await collection.findOne({
      userId: guard.user.id,
      $or: [{ productId }, { "product.id": productId }],
    })
    if (existing) {
      return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 })
    }

    // The badge is earned from order history, never asserted by the client.
    const orders = await dbService.getCollection("orders")
    const purchased = await orders.findOne({
      userId: guard.user.id,
      "items.id": productId,
      status: { $in: ["delivered", "completed"] },
    })

    const review = {
      _id: new ObjectId(),
      ...input,
      productId,
      userId: guard.user.id,
      author: {
        id: guard.user.id,
        name: guard.user.name || guard.user.email?.split("@")[0] || "Customer",
      },
      // Written both ways so the nested-product filter above keeps working.
      product: { id: productId, name: String(product.name || ""), image: String(product.image || "") },
      isVerifiedPurchase: !!purchased,
      status: "published",
      createdAt: new Date(),
    }
    await withReviewTransaction(async session => {
      await collection.insertOne(review, { session })
      await synchronizeReviewStats(productId, session)
      return review
    })

    return NextResponse.json(dbService.normalizeId(review), { status: 201 })
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return NextResponse.json({ error: "You have already reviewed this product" }, { status: 409 })
    }
    console.error("Error creating review:", error)
    return handleApiError(error, "Failed to create review")
  }
}
