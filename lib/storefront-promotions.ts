import { ObjectId, type Document } from "mongodb"
import { COLLECTIONS, getCollection } from "@/lib/db-service"
import { getConfig } from "@/lib/diwali/service"
import { onlineCampaignOpen, onlineGift } from "@/lib/diwali/online-rules"
import { isDiwaliCustomerBlocked } from "@/lib/diwali/blocklist"
import { quoteGiftPromotionPreview } from "@/lib/gift-promotions"
import { priceCatalogueCart, computeCouponDiscount } from "@/lib/order-pricing"
import { PUBLIC_PRODUCT_FILTER, isPublicProduct } from "@/lib/product-visibility"
import { getPublicCatalogueSelection } from "@/lib/public-catalogue"
import { stockItemFilter } from "@/lib/stock-item-code"
import type { AuthSession } from "@/lib/auth"
import type { PromotionBenefit, PromotionProduct, StorefrontPromotions } from "@/lib/storefront-promotion-types"

type CouponCandidate = Document & { _id: ObjectId; code: string; name: string; type: string; endDate?: Date | string; noEndDate?: boolean; applyScope?: string; productIds?: string[]; skus?: string[]; divisions?: string[] }

export async function getStorefrontPromotions(productId: string | null, session: AuthSession | null): Promise<StorefrontPromotions> {
  const [config, coupons] = await Promise.all([
    getConfig(),
    (await getCollection<CouponCandidate>(COLLECTIONS.COUPONS)).find({ active: true }, { maxTimeMS: 4000 }).sort({ createdAt: -1, _id: 1 }).limit(100).toArray(),
  ])
  const userId = session?.user.id || null
  const diwaliAllowed = onlineCampaignOpen(config) && (!session || !await isDiwaliCustomerBlocked({ email: session.user.email, mobile: session.user.phone }))
  const diwaliExpiry = new Date(`${[config.campaignEnd, config.registrationEnd].sort()[0]}T23:59:59.999+05:30`).toISOString()
  const discountCoupons = coupons.filter(coupon => ["fixed", "percentage", "buy_get"].includes(coupon.type)).slice(0, 8)

  async function preview(id: string): Promise<PromotionProduct | null> {
    // Only identity and quantity are passed; checkout's authoritative prices and stock decide.
    const raw = [{ id, quantity: 1 }]
    const priced = await priceCatalogueCart(raw)
    if (!priced.ok || priced.items.length !== 1) return null
    const item = priced.items[0], product = priced.catalogue.get(item.id)
    if (!product || !isPublicProduct(product) || item.type === "service") return null
    const [gifts, discounts] = await Promise.all([
      quoteGiftPromotionPreview(priced.items, userId),
      Promise.all(discountCoupons.map(async coupon => ({ candidate: coupon, quote: await computeCouponDiscount(coupon.code, priced.items, priced.catalogue, userId) }))),
    ])
    const benefits: PromotionBenefit[] = gifts.map(gift => ({
      id: gift.promotionId, kind: "gift", name: gift.name, photo: gift.photo, quantity: gift.quantity,
      expiresAt: gift.expiresAt, selectionRequired: !gift.giftAutoAdd,
      description: `${gift.promotionName}. ${gift.giftAutoAdd ? "Added in cart when eligible." : "Select this gift in cart."}`,
    }))
    const diwali = diwaliAllowed ? onlineGift(config, item.price, 0) : null
    if (diwali) benefits.push({ id: `diwali:${config.consentVersion}:${diwali.giftCode}`, kind: "diwali", name: diwali.label,
      photo: null, quantity: 1, expiresAt: diwaliExpiry, selectionRequired: false,
      description: "Diwali eligibility before coupons. Final paid merchandise value determines the tier; payment confirmation and gift approval are required.",
    })
    for (const { candidate, quote } of discounts) {
      if (!quote.ok) continue
      const finalGift = diwaliAllowed ? onlineGift(config, item.price - quote.coupon.discount, 0) : null
      benefits.push({ id: String(candidate._id), kind: "coupon", name: quote.coupon.name, photo: null, quantity: 1,
        expiresAt: candidate.noEndDate || !candidate.endDate ? null : new Date(candidate.endDate).toISOString(),
        selectionRequired: true, code: quote.coupon.code,
        description: `Save ₹${quote.coupon.discount.toLocaleString("en-IN")} using ${quote.coupon.code}. Choose one coupon at checkout.${diwali ? ` After this coupon: ${finalGift ? finalGift.label + " eligibility" : "no Diwali gift eligibility"}.` : ""}`,
      })
    }
    if (!benefits.length) return null
    const slug = "slug" in product && typeof product.slug === "string" && product.slug ? product.slug : item.id
    return { id: item.id, name: item.name, price: item.price, image: item.image, href: `/product/${encodeURIComponent(slug)}`, benefits }
  }

  let products: PromotionProduct[] = []
  if (productId) {
    const product = await preview(productId)
    if (product) products = [product]
  } else if (diwaliAllowed || coupons.length) {
    const { ids } = await getPublicCatalogueSelection()
    const collection = await getCollection<Document>(COLLECTIONS.PRODUCTS)
    const scopeFilters: Document[] = []
    let scopeBudget = 2000
    const candidateValues = (values: string[]) => {
      const selected = values.filter(value => typeof value === "string" && value.length <= 200).slice(0, Math.min(500, scopeBudget))
      scopeBudget -= selected.length
      return selected
    }
    for (const coupon of coupons) {
      if (coupon.applyScope === "products" && coupon.productIds?.length) {
        const keys = candidateValues(coupon.productIds)
        scopeFilters.push({ id: { $in: keys } }, { _id: { $in: [...keys, ...keys.filter(ObjectId.isValid).map(key => new ObjectId(key))] } })
      }
      if (coupon.applyScope === "skus" && coupon.skus?.length) {
        // Use the real stock aliases, including numeric and literal Excel keys.
        const values = candidateValues(coupon.skus)
        scopeFilters.push(stockItemFilter(values.flatMap(value => [value, value.toUpperCase(), value.toLowerCase()])))
      }
      if (coupon.applyScope === "divisions" && coupon.divisions?.length) scopeFilters.push({ division: { $in: candidateValues(coupon.divisions) } })
      if (!scopeBudget) break
    }
    const base: Document = { $and: [PUBLIC_PRODUCT_FILTER, { _id: { $in: ids } }] }
    const find = (filter: Document, order: Document, limit: number) => collection.find({ $and: [base, filter] }, { projection: { _id: 1, id: 1 }, maxTimeMS: 4000 }).sort(order).limit(limit).toArray()
    const [scoped, diwali, recent] = await Promise.all([
      scopeFilters.length ? find({ $or: scopeFilters }, { updatedAt: -1, _id: 1 }, 8) : [],
      diwaliAllowed ? find({ price: { $gte: 15000 }, stock: { $gt: 0 } }, { price: 1, _id: 1 }, 8) : [],
      find({ stock: { $gt: 0 } }, { updatedAt: -1, _id: 1 }, 8),
    ])
    const candidates = [...new Set([...scoped, ...diwali, ...recent].map(row => String(row._id)))]
    // Bounded discovery, then show at most three genuinely eligible products.
    for (const id of candidates) {
      const product = await preview(id)
      if (product) products.push(product)
      if (products.length === 3) break
    }
  }
  return { verifiedAt: new Date().toISOString(), products }
}
