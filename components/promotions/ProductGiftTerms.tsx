"use client"

import Link from "next/link"
import { useStorefrontPromotions } from "@/hooks/useStorefrontPromotions"
import { formatGiftExpiry } from "@/lib/product-promotion-display"

export default function ProductGiftTerms({ productId }: { productId: string }) {
  const { products, loading, error } = useStorefrontPromotions(productId)
  const product = products[0]
  if (error) return <p role="alert">Gift terms could not be checked. Please refresh this page before relying on an offer.</p>
  if (loading) return <p role="status">Checking current gift terms…</p>
  if (!product) return <p>No eligible offers are currently available for this product. <Link href="/products" className="text-[#1560BD] underline">Browse products</Link></p>
  return <>
    <h2 className="mt-5 text-lg font-semibold">{product.name}</h2>
    <p className="mt-3 text-sm leading-relaxed text-gray-700">Preview for one unit, before coupons and delivery charges. Select optional gifts in cart. Availability and final eligibility are checked again at checkout. A preview does not reserve a gift or approve a claim.</p>
    <ul className="mt-6 space-y-5">{product.benefits.map(benefit => <li key={benefit.id}>
      <h3 className="font-semibold">{benefit.quantity > 1 ? `${benefit.quantity} × ` : ""}{benefit.name}{benefit.code ? ` · ${benefit.code}` : ""}</h3>
      <p className="mt-1 text-sm leading-relaxed text-gray-700">{benefit.description}</p>
      {benefit.expiresAt && <p className="mt-1 text-xs text-gray-500">{formatGiftExpiry(benefit.expiresAt)}</p>}
    </li>)}</ul>
    {product.benefits.some(benefit => benefit.kind === "diwali") && <Link href="/diwali-gift/terms" className="mt-5 inline-block font-semibold text-[#1560BD] underline">Read the approved Diwali campaign terms</Link>}
    <p className="mt-6"><Link href={product.href} className="font-semibold text-[#1560BD] underline">Back to product</Link></p>
  </>
}
