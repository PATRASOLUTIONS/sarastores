import type { Metadata } from "next"
import type { ReactNode } from "react"
import { getCollection } from "@/lib/db-service"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"
import { titleCaseLabel } from "@/lib/product-display"

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params
  const [origin, settings, collection] = await Promise.all([
    getOriginFromHeaders(), getSiteSettings(), getCollection("sub_categories"),
  ])
  const decodedParam = decodeURIComponent(name)
  const decodedName = decodedParam.replace(/-/g, " ")
  const subCategory = await collection.findOne({ $or: [
    { slug: decodedParam },
    { name: { $regex: `^${decodedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } },
  ] })
  const displayName = titleCaseLabel(String(subCategory?.name || decodedName))
  const companyName = getCompanyName(settings)
  return buildPageMetadata({
    title: `${displayName} | ${companyName}`,
    description: subCategory?.description || `Explore ${displayName.toLowerCase()} at ${companyName}. Compare product specifications, prices and availability.`,
    pageUrl: `${origin}/sub-category/${encodeURIComponent(subCategory?.name || decodedName)}`,
    origin, companyName, imageUrl: subCategory?.image,
    noIndex: !subCategory || subCategory.active === false,
  })
}

export default function SubCategoryLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
