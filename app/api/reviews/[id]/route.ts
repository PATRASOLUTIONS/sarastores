import { type NextRequest, NextResponse } from "next/server"
import * as dbService from "@/lib/db-service"
import { COLLECTIONS } from "@/lib/db-service"
import { handleApiError } from "@/lib/api-error"
import { requireUser } from "@/lib/auth"
import { UpdateReviewSchema } from "@/lib/validation"
import { publishedReviewFilter, reviewIdFilter, synchronizeReviewStats, withReviewTransaction, type CustomerReviewDocument } from "@/lib/reviews"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const collection = await dbService.getCollection<CustomerReviewDocument>(COLLECTIONS.REVIEWS)
    const review = await collection.findOne({ $and: [reviewIdFilter(id), publishedReviewFilter()] })

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 })
    }

    return NextResponse.json(dbService.normalizeId(review), { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Error fetching review:", error)
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    const parsed = UpdateReviewSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Invalid review", details: parsed.error.flatten().fieldErrors }, { status: 400 })
    return await withReviewTransaction(async session => {
      const collection = await dbService.getCollection<CustomerReviewDocument>(COLLECTIONS.REVIEWS)
      const review = await collection.findOne(reviewIdFilter(id), { session })
      if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })
      if (review.userId !== guard.user.id && !["admin", "superadmin"].includes(guard.user.role || "")) {
        return NextResponse.json({ error: "You cannot edit another customer's review" }, { status: 403 })
      }
      const productId = review.productId || review.product?.id
      if (!productId) throw new Error("The review is not linked to a product")
      const update = { ...parsed.data, updatedAt: new Date() }
      await collection.updateOne({ _id: review._id }, { $set: update }, { session })
      await synchronizeReviewStats(productId, session)
      return NextResponse.json(dbService.normalizeId({ ...review, ...update }))
    })
  } catch (error) {
    console.error("Error updating review:", error)
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const guard = await requireUser()
  if (!guard.ok) return guard.response
  try {
    const { id } = await context.params
    return await withReviewTransaction(async session => {
      const collection = await dbService.getCollection<CustomerReviewDocument>(COLLECTIONS.REVIEWS)
      const review = await collection.findOne(reviewIdFilter(id), { session })
      if (!review) return NextResponse.json({ error: "Review not found" }, { status: 404 })
      if (review.userId !== guard.user.id && !["admin", "superadmin"].includes(guard.user.role || "")) {
        return NextResponse.json({ error: "You cannot delete another customer's review" }, { status: 403 })
      }
      const productId = review.productId || review.product?.id
      if (!productId) throw new Error("The review is not linked to a product")
      await collection.deleteOne({ _id: review._id }, { session })
      await synchronizeReviewStats(productId, session)
      return NextResponse.json({ success: true })
    })
  } catch (error) {
    console.error("Error deleting review:", error)
    return handleApiError(error)
  }
}
