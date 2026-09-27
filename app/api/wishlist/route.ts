import { NextResponse } from "next/server"
import { getCollection } from "@/lib/db-service"
import { normalizeId } from "@/lib/db-service"
import { ObjectId } from "mongodb"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"

// Schema for adding to wishlist
const addToWishlistSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
})

export async function GET(request: Request) {
  try {
    // Authoritative user id from the signed session — never trust client input.
    const userId = await getCurrentUserId()
    if (!userId) {
      return NextResponse.json({ message: "Authentication required" }, { status: 401 })
    }

    const wishlistCollection = await getCollection("wishlists")
    const wishlist = await wishlistCollection.findOne({ userId })

    if (!wishlist) {
      return NextResponse.json({ items: [] })
    }

    // If we have product IDs, fetch the full product details
    if (wishlist.items && wishlist.items.length > 0) {
      const productsCollection = await getCollection("products")
      const productIds = wishlist.items.map((id: string) => {
        try {
          return new ObjectId(id)
        } catch (e) {
          return id // If it's not a valid ObjectId, use the string
        }
      })

      const products = await productsCollection.find({ _id: { $in: productIds } }).toArray()

      // Ensure slug exists on each product
      const { generateProductSlug } = await import("@/utils/slug")
      const productsWithSlug = normalizeId(products).map((p: any) => {
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

    const wishlistCollection = await getCollection("wishlists")

    // Check if wishlist exists
    const wishlist = await wishlistCollection.findOne({ userId })

    if (wishlist) {
      // Check if product is already in wishlist
      if (wishlist.items.includes(productId)) {
        return NextResponse.json({
          message: "Product already in wishlist",
          added: false,
        })
      }

      // Add product to existing wishlist
      await wishlistCollection.updateOne({ userId }, { $push: { items: productId }, $set: { updatedAt: new Date() } })
    } else {
      // Create new wishlist
      await wishlistCollection.insertOne({
        userId,
        items: [productId],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

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

    const wishlistCollection = await getCollection("wishlists")

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
