import { ObjectId, type ClientSession, type Document, type Filter } from "mongodb"
import { COLLECTIONS, getCollection, getById, normalizeId } from "@/lib/db-service"
import { getMongoClient } from "@/lib/mongodb"

export interface CustomerReviewDocument extends Document {
  _id: ObjectId | string
  productId?: string
  product?: { id?: string }
  userId?: string
  rating: number
  title?: string
  content?: string
  status?: string
}

let indexesReady: Promise<unknown> | undefined

export function reviewIdFilter(id: string): Filter<CustomerReviewDocument> {
  return { $or: [
    ...(ObjectId.isValid(id) ? [{ _id: new ObjectId(id) }] : []),
    { _id: id },
    { id },
  ] }
}

export function publishedReviewFilter(productId?: string): Filter<CustomerReviewDocument> {
  const publicStatus = { $or: [{ status: { $in: ["published", "approved"] } }, { status: { $exists: false } }] }
  return productId ? { $and: [publicStatus, { $or: [{ productId }, { "product.id": productId }] }] } : publicStatus
}

export async function getReviewProduct(id: string) {
  const products = await getCollection<Document & { _id: ObjectId | string }>(COLLECTIONS.PRODUCTS)
  const product = await products.findOne({ slug: id })
  return product ? normalizeId(product) : getById(COLLECTIONS.PRODUCTS, id)
}

export async function withReviewTransaction<T>(operation: (session: ClientSession) => Promise<T>): Promise<T> {
  if (!indexesReady) {
    indexesReady = getCollection<CustomerReviewDocument>(COLLECTIONS.REVIEWS).then(collection =>
      collection.createIndex({ productId: 1, userId: 1 }, {
        name: "unique_customer_product_review",
        unique: true,
        partialFilterExpression: { productId: { $type: "string" }, userId: { $type: "string" } },
      }),
    ).catch(error => {
      indexesReady = undefined
      console.error("[Reviews] Index initialization failed:", error)
      throw error
    })
  }
  await indexesReady
  const client = await getMongoClient()
  const session = client.startSession()
  try {
    const result = await session.withTransaction(() => operation(session))
    if (result === undefined) throw new Error("Review transaction did not complete")
    return result
  } finally {
    await session.endSession()
  }
}

export async function synchronizeReviewStats(productId: string, session: ClientSession) {
  const reviews = await getCollection<CustomerReviewDocument>(COLLECTIONS.REVIEWS)
  const [summary] = await reviews.aggregate<{ count: number; ratingSum: number; rating: number }>([
    { $match: { $and: [publishedReviewFilter(productId), { rating: { $type: "number", $gte: 1, $lte: 5 } }] } },
    { $group: { _id: null, count: { $sum: 1 }, ratingSum: { $sum: "$rating" }, rating: { $avg: "$rating" } } },
  ], { session }).toArray()
  const stats = { reviewsCount: summary?.count || 0, reviewCount: summary?.count || 0, ratingSum: summary?.ratingSum || 0, rating: summary?.rating || 0 }
  const products = await getCollection<Document & { _id: ObjectId | string }>(COLLECTIONS.PRODUCTS)
  const result = await products.updateOne({ $or: [
    ...(ObjectId.isValid(productId) ? [{ _id: new ObjectId(productId) }] : []),
    { _id: productId },
    { id: productId },
  ] }, { $set: { ...stats, reviewsUpdatedAt: new Date() } }, { session })
  if (!result.matchedCount) throw new Error("The reviewed product no longer exists")
  return stats
}
