import type { Metadata } from "next"
import type { ReactNode } from "react"
import { getCollection } from "@/lib/db-service"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"
import { titleCaseLabel } from "@/lib/product-display"
import { notFound } from "next/navigation"
import { cache } from "react"

const getSubCategory = cache(async (name: string) => {
  const decodedParam = decodeURIComponent(name)
  const aliases = [...new Set([decodedParam, decodedParam.replace(/-/g, " ")])]
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return (await getCollection("sub_categories")).findOne({ active: { $ne: false }, $or: [
    { slug: decodedParam },
    ...aliases.map(alias => ({ name: { $regex: `^${escape(alias)}$`, $options: "i" } })),
  ] })
})

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const [origin, settings, subCategory] = await Promise.all([
    getOriginFromHeaders(), getSiteSettings(), getSubCategory(name),
  ])
  if (!subCategory) notFound()
  const displayName = titleCaseLabel(String(subCategory.name))
  const companyName = getCompanyName(settings)
  return buildPageMetadata({
    title: `${displayName} | ${companyName}`,
    description: subCategory?.description || `Explore ${displayName.toLowerCase()} at ${companyName}. Compare product specifications, prices and availability.`,
    pageUrl: `${origin}/sub-category/${encodeURIComponent(subCategory.name)}`,
    origin, companyName, imageUrl: subCategory?.image,
  })
}

export default async function SubCategoryLayout({ children, params }: {
  children: ReactNode; params: Promise<{ name: string }>
}) {
  const { name } = await params
  if (!await getSubCategory(name)) notFound()
  return <>{children}</>
}
