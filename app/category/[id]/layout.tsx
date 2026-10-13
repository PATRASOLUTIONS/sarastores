import type { Metadata } from "next"
import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { getSeoCategory } from "@/lib/seo-category"
import { titleCaseLabel } from "@/lib/product-display"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"
import { CategoryJsonLdServer } from "./CategoryJsonLdServer"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const [origin, settings, category] = await Promise.all([
    getOriginFromHeaders(), getSiteSettings(), getSeoCategory(id),
  ])
  if (!category) notFound()
  const companyName = getCompanyName(settings)
  const name = titleCaseLabel(String(category.name))
  return buildPageMetadata({
    title: `${name} | ${companyName}`,
    description: category.description || `Explore ${name.toLowerCase()} at ${companyName}. Compare products, prices, availability and delivery options.`,
    pageUrl: `${origin}/category/${encodeURIComponent(category.slug || category.id)}`,
    origin, companyName, imageUrl: category.image, noIndex: category.isEnabled === false,
  })
}

export default async function CategoryLayout({ children, params }: {
  children: ReactNode; params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!await getSeoCategory(id)) notFound()
  return <><CategoryJsonLdServer categoryName={id} origin={await getOriginFromHeaders()} />{children}</>
}
