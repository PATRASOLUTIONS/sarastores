import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"

// Get cart for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      // Return empty cart instead of 401 — cart is not sensitive data
      // and the client falls back to localStorage for guests
      return NextResponse.json({ userId: "guest", items: [] })
    }

    const collection = await getCollection("carts")
    const cart = await collection.findOne({ userId })

    return NextResponse.json(cart ? normalizeId(cart) : { userId, items: [] })
  } catch (error) {
    console.error("Error getting cart:", error)
    return NextResponse.json({ error: "Failed to get cart" }, { status: 500 })
  }
}

// Update cart for the authenticated user
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) {
      // Return success instead of 401 — client uses localStorage for guests
      return NextResponse.json({ success: true, guest: true })
    }

    const body = await request.json()

    // Inline schema for cart validation
    const cartItemSchema = z.object({
      productId: z.string().min(1, 'Product ID is required'),
      id: z.string().optional(),
      name: z.string().optional(),
      title: z.string().optional(),
      price: z.union([z.number(), z.string()]),
      quantity: z.union([z.number(), z.string()]),
      image: z.string().optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      type: z.string().optional(),
      provider: z.string().optional(),
      source: z.string().optional(),
      maxDevices: z.union([z.number(), z.string()]).optional(),
      packSize: z.union([z.number(), z.string()]).optional(),
      validityYears: z.union([z.number(), z.string()]).optional(),
      validity: z.union([z.number(), z.string()]).optional(),
      color: z.string().optional(),
      size: z.string().optional(),
      kgenProductId: z.string().optional(),
      kgenVariantId: z.string().optional(),
    })

    const cartSchema = z.object({
      items: z.array(cartItemSchema),
    })

    const parsed = cartSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { items } = parsed.data

    const collection = await getCollection("carts")

    // Check if cart exists
    const existingCart = await collection.findOne({ userId })

    if (existingCart) {
      // Update existing cart
      await collection.updateOne({ userId }, { $set: { items, updatedAt: new Date() } })
    } else {
      // Create new cart
      await collection.insertOne({
        userId,
        items,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating cart:", error)
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 })
  }
}
