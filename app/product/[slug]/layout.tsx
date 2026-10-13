import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"
import { getSeoProduct } from "@/lib/seo-product"
import { ProductJsonLdServer } from "./ProductJsonLdServer"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [origin, settings, product] = await Promise.all([
    getOriginFromHeaders(), getSiteSettings(), getSeoProduct(slug),
  ])
  if (!product) notFound()
  const companyName = getCompanyName(settings)
  const discount = product.price && product.mrp > product.price
    ? Math.round((product.mrp - product.price) / product.mrp * 100) : 0
  const priceText = product.price
    ? `${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(product.price)}${discount ? ` (${discount}% off)` : ""}. `
    : ""
  const description = product.attributes.seoDescription ||
    `${priceText}${product.description || `Explore ${product.name} at ${companyName}. Check product details and delivery availability.`}`.slice(0, 200)
  const metadata = buildPageMetadata({
    title: product.attributes.seoTitle || `${product.name} | ${companyName}`,
    description, pageUrl: `${origin}/product/${encodeURIComponent(product.slug)}`,
    origin, companyName, imageUrl: product.images[0],
  })
  return {
    ...metadata,
    other: {
      ...(product.price && { "product:price:amount": String(product.price), "product:price:currency": "INR" }),
      "product:availability": product.inStock ? "instock" : "outofstock",
      "product:condition": "new",
      "product:retailer_item_id": product.sku || product.id,
      ...(product.brand && { "product:brand": product.brand }),
      ...(product.category && { "product:category": product.category }),
      ...(discount && { "product:original_price:amount": String(product.mrp), "product:original_price:currency": "INR" }),
      ...(product.updatedAt && Number.isFinite(product.updatedAt.getTime()) && { "og:updated_time": product.updatedAt.toISOString() }),
    },
  }
}

export default async function ProductLayout({ children, params }: {
  children: ReactNode; params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!await getSeoProduct(slug)) notFound()
  return <><ProductJsonLdServer slug={slug} origin={await getOriginFromHeaders()} />{children}</>
}
