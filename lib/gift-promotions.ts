import { type ClientSession, ObjectId } from "mongodb"
import { getCollection } from "@/lib/db-service"
import { GiftAwardSchema, type GiftAward, type Gift } from "@/lib/gift-validation"
import type { PricedItem } from "@/lib/order-pricing"

interface GiftPromotion {
  _id: ObjectId; code: string; name: string; type: string; active: boolean; giftId?: string | null
  applyScope?: string; productIds?: string[]; skus?: string[]; divisions?: string[]
  startDate?: Date | string | null; endDate?: Date | string | null; noEndDate?: boolean
  buyQty?: number; getQty?: number; usageCount?: number; usageLimit?: number; perCustomerLimit?: number
  usageByUser?: { userId: string; count: number; lastUsed?: Date }[]
}

export function giftQuantity(promotion: GiftPromotion, items: PricedItem[], userId: string | null, now = new Date()): number {
  const { buyQty, getQty } = promotion
  if (!promotion.active || !promotion.giftId || !Number.isSafeInteger(buyQty) || !Number.isSafeInteger(getQty) || !buyQty || !getQty || buyQty < 1 || getQty < 1 || getQty > 100) return 0
  const start = promotion.startDate ? new Date(promotion.startDate) : null
  const end = !promotion.noEndDate && promotion.endDate ? new Date(promotion.endDate) : null
  // Date-only Valid until includes that entire day in India.
  if (!start || !Number.isFinite(start.getTime()) || now < start || (!promotion.noEndDate && !end) || (end && (!Number.isFinite(end.getTime()) || now > end))) return 0
  const limits = [promotion.usageCount ?? 0, promotion.usageLimit ?? 0, promotion.perCustomerLimit ?? 0]
  if (limits.some(limit => !Number.isSafeInteger(limit) || limit < 0)) return 0
  if (promotion.usageLimit && (promotion.usageCount || 0) >= promotion.usageLimit) return 0
  if (promotion.perCustomerLimit) {
    if (!userId) return 0 // Match the existing authenticated per-customer coupon policy.
    const count = promotion.usageByUser?.find(record => record.userId === userId)?.count ?? 0
    if (!Number.isSafeInteger(count) || count < 0 || count >= promotion.perCustomerLimit) return 0
  }
  const lower = (value: string) => value.trim().toLowerCase()
  const eligible = items.filter(item => {
    switch (promotion.applyScope || "all") {
      case "all": return true
      case "products": return promotion.productIds?.includes(item.id)
      case "skus": return !!item.sku && promotion.skus?.some(sku => lower(sku) === lower(item.sku!))
      case "divisions": return !!item.division && promotion.divisions?.some(division => lower(division) === lower(item.division!))
      default: return false
    }
  })
  const units = eligible.reduce((sum, item) => sum + item.quantity, 0)
  return Math.min(100, Math.floor(units / buyQty) * getQty)
}

export async function quoteGiftPromotions(items: PricedItem[], userId: string | null, declined: string[] = [], session?: ClientSession): Promise<GiftAward[]> {
  if (!items.length) return []
  const promotions = await (await getCollection<GiftPromotion>("coupons")).find({ type: "buy_get_product", active: true }, { session }).sort({ createdAt: 1, _id: 1 }).limit(100).toArray()
  const qualifying = promotions.map(promotion => ({ promotion, quantity: giftQuantity(promotion, items, userId) }))
    .filter(({ promotion, quantity }) => quantity > 0 && !declined.includes(promotion._id.toString()))
  if (!qualifying.length) return []
  const gifts = await (await getCollection<Omit<Gift, "id"> & { _id: string }>("gift_items")).find({ _id: { $in: qualifying.map(({ promotion }) => promotion.giftId!) }, active: true }, { session }).toArray()
  return qualifying.flatMap(({ promotion, quantity }) => {
    const gift = gifts.find(gift => gift._id === promotion.giftId)
    if (!gift) return []
    const parsed = GiftAwardSchema.safeParse({ ...gift, giftId: gift._id, promotionId: promotion._id.toString(), code: promotion.code, promotionName: promotion.name, quantity })
    return parsed.success ? [parsed.data] : []
  })
}

export async function consumeGiftPromotions(awards: GiftAward[], orderId: string, userId: string | null, session: ClientSession) {
  if (!awards.length) return
  const promotions = await getCollection<GiftPromotion>("coupons")
  for (const award of awards) {
    const promotion = await promotions.findOne({ _id: new ObjectId(award.promotionId), type: "buy_get_product", active: true }, { session })
    if (!promotion || promotion.giftId !== award.giftId) throw new Error("A free gift promotion changed. Please review checkout.")
    const used = promotion.usageByUser?.find(record => record.userId === userId)?.count || 0
    if ((promotion.usageLimit && (promotion.usageCount || 0) >= promotion.usageLimit) || (promotion.perCustomerLimit && (!userId || used >= promotion.perCustomerLimit))) throw new Error("A free gift promotion reached its usage limit.")
    const existing = !!userId && promotion.usageByUser?.some(record => record.userId === userId)
    const update = existing ? {
      $inc: { usageCount: 1, "usageByUser.$[user].count": 1 }, $set: { "usageByUser.$[user].lastUsed": new Date() },
    } : { $inc: { usageCount: 1 }, ...(userId ? { $push: { usageByUser: { userId, count: 1, lastUsed: new Date() } } } : {}) }
    const claimed = await promotions.updateOne({ _id: promotion._id, ...(promotion.usageLimit ? { usageCount: { $lt: promotion.usageLimit } } : {}) }, update,
      { session, ...(existing ? { arrayFilters: [{ "user.userId": userId }] } : {}) })
    if (!claimed.modifiedCount) throw new Error("Free gift usage could not be recorded.")
    await (await getCollection<{ _id: string; orderId: string; userId: string | null; promotionId: string; quantity: number; createdAt: Date }>("gift_promotion_redemptions")).insertOne({
      _id: `${award.promotionId}:${orderId}`, orderId, userId, promotionId: award.promotionId, quantity: award.quantity, createdAt: new Date(),
    }, { session })
  }
}
