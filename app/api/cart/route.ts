import { type NextRequest, NextResponse } from "next/server"
import { getCollection, normalizeId } from "@/lib/db-service"
import { getCurrentUserId } from "@/lib/auth"
import { z } from "zod"
import { priceOrder } from "@/lib/order-pricing"
import { MAX_CART_PRODUCTS } from "@/lib/cart-limits"
import { ObjectId } from "mongodb"

type StoredCartItem = {
  id?: string
  productId?: string
  type?: string
}

async function removeInactiveProducts(items: StoredCartItem[]): Promise<StoredCartItem[]> {
  const hardwareIds = [...new Set(items
    .filter(item => item.type !== "software")
    .flatMap(item => [item.productId, item.id])
    .filter((id): id is string => typeof id === "string" && id.length > 0))]
  if (hardwareIds.length === 0) return items

  const objectIds = hardwareIds.filter(ObjectId.isValid).map(id => new ObjectId(id))
  const products = await getCollection<{ _id: ObjectId | string; id?: string; active?: boolean }>("products")
  const inactive = await products.find({
    active: { $ne: true },
    $or: [
      ...(objectIds.length ? [{ _id: { $in: objectIds } }] : []),
      { _id: { $in: hardwareIds } },
      { id: { $in: hardwareIds } },
    ],
  }, { projection: { _id: 1, id: 1 } }).toArray()
  const hiddenIds = new Set(inactive.flatMap(product => [
    product._id.toString(),
    ...(product.id ? [product.id] : []),
  ]))
  return items.filter(item =>
    item.type === "software" || ![item.productId, item.id].some(id => id && hiddenIds.has(id)),
  )
}

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

    if (!cart) return NextResponse.json({ userId, items: [] })
    const normalized = normalizeId(cart)
    const items = Array.isArray(normalized.items)
      ? request.nextUrl.searchParams.get("checkoutSelection") === "true"
        ? normalized.items
        : await removeInactiveProducts(normalized.items as StoredCartItem[])
      : []
    return NextResponse.json({ ...normalized, items }, { headers: { "Cache-Control": "private, no-store" } })
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
      productId: z.string().min(1).optional(),
      id: z.string().optional(),
      name: z.string().optional(),
      title: z.string().optional(),
      price: z.union([z.number(), z.string()]),
      quantity: z.coerce.number().int().positive().safe(),
      image: z.string().optional(),
      imageUrl: z.string().optional(),
      category: z.string().optional(),
      type: z.string().optional(),
      provider: z.string().optional(),
      source: z.string().optional(),
      maxDevices: z.union([z.number(), z.string()]).optional(),
      packSize: z.union([z.number(), z.string()]).optional(),
      validityYears: z.union([z.number(), z.string()]).optional(),
      validity: z.union([z.number(), z.string()]).transform(String).optional(),
      color: z.string().nullable().optional(),
      size: z.string().nullable().optional(),
      kgenProductId: z.string().optional(),
      kgenVariantId: z.string().optional(),
    }).passthrough().refine((item) => item.productId || item.id, "Product ID is required")

    const cartSchema = z.object({
      items: z.array(cartItemSchema).max(MAX_CART_PRODUCTS, "You can add up to 20 different products to your cart."),
    })

    const parsed = cartSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { items } = parsed.data
    const pricing = items.length ? await priceOrder(items, { userId }) : null
    if (pricing && !pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 })
    const validatedItems = pricing?.ok ? items.map((item, index) => ({
      ...item, id: pricing.items[index].id, productId: pricing.items[index].id,
      price: pricing.items[index].price, quantity: pricing.items[index].quantity,
    })) : []

    const collection = await getCollection("carts")

    // Check if cart exists
    const existingCart = await collection.findOne({ userId })

    if (existingCart) {
      // Update existing cart
      await collection.updateOne({ userId }, { $set: { items: validatedItems, updatedAt: new Date() } })
    } else {
      // Create new cart
      await collection.insertOne({
        userId,
        items: validatedItems,
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
