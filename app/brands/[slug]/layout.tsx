import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { getSeoBrand as getBrand } from "@/lib/seo-brand"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"
import { BrandJsonLdServer } from "./BrandJsonLdServer"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [origin, settings, brand] = await Promise.all([
    getOriginFromHeaders(), getSiteSettings(), getBrand(slug),
  ])
  if (!brand) notFound()
  const companyName = getCompanyName(settings)
  return buildPageMetadata({
    title: `${brand.name} Products | ${companyName}`,
    description: brand.description || brand.heroContent?.description || brand.tagline ||
      `Explore ${brand.name} electronics and appliances at ${companyName}. Browse product details, prices and availability.`,
    pageUrl: `${origin}/brands/${encodeURIComponent(brand.slug)}`,
    origin, companyName, imageUrl: brand.banners?.[0]?.url || brand.logo,
    noIndex: brand.landingPageEnabled === false,
  })
}

export default async function BrandLayout({ children, params }: {
  children: ReactNode; params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const brand = await getBrand(slug)
  if (!brand) notFound()
  return <><BrandJsonLdServer slug={brand.slug} origin={await getOriginFromHeaders()} />{children}</>
}
