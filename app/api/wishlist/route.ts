import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { normalizeId } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"
import { PUBLIC_PRODUCT_FILTER } from "@/lib/product-visibility"

// Schema for adding to wishlist
const addToWishlistSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
})

type WishlistDocument = {
  userId: string
  items: string[]
  createdAt?: Date
  updatedAt?: Date
}

export async function GET(request: Request) {
  try {
    // Authoritative user id from the signed session — never trust client input.
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }

    const wishlistCollection = await getCollection<WishlistDocument>("wishlists")
    const wishlist = await wishlistCollection.findOne({ userId })

    if (!wishlist) {
      return NextResponse.json({ items: [] })
    }

    // If we have product IDs, fetch the full product details
    if (wishlist.items && wishlist.items.length > 0) {
      const productsCollection = await getCollection<{ _id: ObjectId | string; name?: string; slug?: string; active?: boolean }>("products")
      const productIds = wishlist.items.map((id: string) => {
        try {
          return new ObjectId(id)
        } catch (e) {
          return id // If it's not a valid ObjectId, use the string
        }
      })

      const products = await productsCollection.find({
        ...PUBLIC_PRODUCT_FILTER,
        $or: [{ _id: { $in: [...productIds, ...wishlist.items] } }, { id: { $in: wishlist.items } }],
      }).toArray()
      const softwareCollection = await getCollection<{ _id: ObjectId | string; id?: string; name?: string; slug?: string; status?: string }>("software_products")
      const software = await softwareCollection.find({
        $or: [{ _id: { $in: [...productIds, ...wishlist.items] } }, { id: { $in: wishlist.items } }],
        status: { $nin: ["inactive", "deleted"] },
      }).toArray()

      // Ensure slug exists on each product
      const { generateProductSlug } = await import("@/utils/slug")
      const productsWithSlug = normalizeId([
        ...products.map(product => ({ ...product, type: "hardware" })),
        ...software.map(product => ({ ...product, type: "software" })),
      ]).map((p) => {
        if (!p.slug && p.name) p.slug = generateProductSlug(p.name)
        return p
      })

      return NextResponse.json({
        items: productsWithSlug,
      })
    }

    return NextResponse.json({ items: [] })
  } catch (error) {
    console.error("Error fetching wishlist:", error)
    return NextResponse.json({ message: "An error occurred while fetching wishlist" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = addToWishlistSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { productId } = parsed.data

    const wishlistCollection = await getCollection<WishlistDocument>("wishlists")
    const productsCollection = await getCollection<{ _id: ObjectId | string; id?: string; active?: boolean }>("products")
    const product = await productsCollection.findOne({
      ...PUBLIC_PRODUCT_FILTER,
      $or: [
        ...(ObjectId.isValid(productId) ? [{ _id: new ObjectId(productId) }] : []),
        { _id: productId },
        { id: productId },
      ],
    })
    const softwareCollection = !product
      ? await getCollection<{ _id: ObjectId | string; id?: string; status?: string }>("software_products") : null
    const software = softwareCollection ? await softwareCollection.findOne({
      status: { $nin: ["inactive", "deleted"] },
      $or: [
        ...(ObjectId.isValid(productId) ? [{ _id: new ObjectId(productId) }] : []),
        { _id: productId }, { id: productId },
      ],
    }) : null
    if (!product && !software) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 })
    }

    // Check if wishlist exists
    const wishlist = await wishlistCollection.findOne({ userId })

    if (wishlist?.items.includes(productId)) {
      return NextResponse.json({
        message: "Product already in wishlist",
        added: false,
      })
    }
    // Retrying or saving concurrently must not duplicate the product.
    await wishlistCollection.updateOne({ userId }, {
      $addToSet: { items: productId },
      $set: { updatedAt: new Date() },
      $setOnInsert: { userId, createdAt: new Date() },
    }, { upsert: true })

    return NextResponse.json({
      message: "Product added to wishlist",
      added: true,
    })
  } catch (error) {
    console.error("Error adding to wishlist:", error)
    return NextResponse.json({ message: "An error occurred while adding to wishlist" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get("productId")
    if (!productId) {
      return NextResponse.json({ message: "Product ID is required" }, { status: 400 })
    }

    const wishlistCollection = await getCollection<WishlistDocument>("wishlists")

    // Remove product from wishlist
    await wishlistCollection.updateOne({ userId }, { $pull: { items: productId }, $set: { updatedAt: new Date() } })

    return NextResponse.json({
      message: "Product removed from wishlist",
      removed: true,
    })
  } catch (error) {
    console.error("Error removing from wishlist:", error)
    return NextResponse.json({ message: "An error occurred while removing from wishlist" }, { status: 500 })
  }
}
