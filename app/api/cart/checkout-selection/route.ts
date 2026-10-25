import { NextRequest, NextResponse } from "next/server"
import { requireUser } from "@/lib/auth"
import { getCollection } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { handleApiError } from "@/lib/api-error"
import { CheckoutCartSelectionSchema } from "@/lib/validation"
import { mergeCheckoutCart } from "@/lib/checkout-cart"
import { priceOrder } from "@/lib/order-pricing"
import type { CartItem } from "@/contexts/CartContext"

type SavedCart = { userId: string; items: CartItem[]; createdAt?: Date; updatedAt?: Date;
  checkoutSelectionId?: string; checkoutSelectionAction?: "include" | "wishlist";
  checkoutDraft?: { requestId: string; currentItems: CartItem[]; previousItems: CartItem[] } }
type SavedWishlist = { userId: string; items: string[]; createdAt?: Date; updatedAt?: Date }

const signature = (items: Array<{ id?: string; productId?: string; quantity: number }>) =>
  JSON.stringify(items.map(item => [item.id || item.productId, Number(item.quantity)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))

export async function POST(request: NextRequest) {
  try {
    const guard = await requireUser()
    if (!guard.ok) return guard.response
    const parsed = CheckoutCartSelectionSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid cart selection" }, { status: 400 })
    const userId = guard.user.id
    const { requestId, action, items, previousItems } = parsed.data
    let failure: { error: string; status: number } | null = null
    let committedItems: CartItem[] = []
    let appliedAction: "include" | "wishlist" = action === "wishlist" ? "wishlist" : "include"
    let pending = false
    let currentItems: CartItem[] = []
    let savedPreviousItems: CartItem[] = []
    const [{ client }, carts, wishlists] = await Promise.all([
      connectToDatabase(), getCollection<SavedCart>("carts"), getCollection<SavedWishlist>("wishlists"),
    ])
    const session = client.startSession()
    try {
      await session.withTransaction(async () => {
        failure = null
        pending = false
        currentItems = []
        savedPreviousItems = []
        const saved = await carts.findOne({ userId }, { session })
        // A lost response must not double quantities when the same choice is retried.
        if (saved?.checkoutSelectionId === requestId) {
          committedItems = saved.items
          appliedAction = saved.checkoutSelectionAction || "include"
          return
        }
        const draft = saved?.checkoutDraft?.requestId === requestId ? saved.checkoutDraft : null
        const accountItems = Array.isArray(saved?.items) ? saved.items : []
        const previous = draft ? draft.previousItems : accountItems
        if (action === "preserve" && draft) {
          committedItems = accountItems
          currentItems = draft.currentItems
          savedPreviousItems = draft.previousItems
          pending = true
          return
        }
        if (action !== "preserve" && signature(previous) !== signature(previousItems)) {
          failure = { error: "Your saved cart changed. Reload the saved items and choose again.", status: 409 }
          return
        }
        if (draft && signature(accountItems) !== signature(mergeCheckoutCart(draft.currentItems, draft.previousItems))) {
          failure = { error: "Your saved cart changed. Keep both items in your cart and review it before checking out again.", status: 409 }
          return
        }
        if (action === "preserve") {
          // This saves selections, including unavailable items, before asking
          // the shopper what to buy. Stored prices are display hints; choosing
          // a purchase below and every payment/order reprice the catalogue.
          committedItems = mergeCheckoutCart(items as CartItem[], previous)
          currentItems = items as CartItem[]
          savedPreviousItems = previous
          pending = previous.length > 0
          await carts.updateOne({ userId }, {
            $set: { items: committedItems, updatedAt: new Date(),
              ...(pending ? { checkoutDraft: { requestId, currentItems, previousItems: previous } }
                : { checkoutSelectionId: requestId, checkoutSelectionAction: "include" as const }),
            },
            ...(!pending ? { $unset: { checkoutDraft: "" } } : {}),
            $setOnInsert: { userId, createdAt: new Date() },
          }, { upsert: true, session })
          return
        }
        const next = action === "include" ? mergeCheckoutCart(items as CartItem[], previous) : items as CartItem[]
        const pricing = await priceOrder(next, { userId })
        if (!pricing.ok) { failure = { error: pricing.error, status: 400 }; return }
        const validated = next.map((item, index) => ({ ...item,
          id: pricing.items[index].id, productId: pricing.items[index].id,
          price: pricing.items[index].price, quantity: pricing.items[index].quantity,
        }))
        committedItems = validated
        if (action === "wishlist" && previous.length) {
          const ids = [...new Set(previous.map(item => item.id || (item as CartItem & { productId?: string }).productId)
            .filter((id): id is string => typeof id === "string" && id.length > 0))]
          await wishlists.updateOne({ userId }, {
            $addToSet: { items: { $each: ids } }, $set: { updatedAt: new Date() },
            $setOnInsert: { userId, createdAt: new Date() },
          }, { upsert: true, session })
        }
        await carts.updateOne({ userId }, {
          $set: { items: validated, updatedAt: new Date(), checkoutSelectionId: requestId, checkoutSelectionAction: action },
          $setOnInsert: { userId, createdAt: new Date() },
          $unset: { checkoutDraft: "" },
        }, { upsert: true, session })
      })
    } finally { await session.endSession() }
    if (failure) {
      const rejected = failure as { error: string; status: number }
      return NextResponse.json({ error: rejected.error }, { status: rejected.status })
    }
    return NextResponse.json({ success: true, action: appliedAction, items: committedItems,
      pending, currentItems, previousItems: savedPreviousItems }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) { return handleApiError(error) }
}
