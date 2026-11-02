import type { ReactNode } from "react"
import { cache } from "react"
import { notFound } from "next/navigation"
import { getCollection } from "@/lib/db-service"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"

const getCampaign = cache(async () => {
  return (await getCollection("campaign_pages")).findOne({ slug: "super-sunday", isActive: true })
})

export async function generateMetadata() {
  const [campaign, origin, settings] = await Promise.all([getCampaign(), getOriginFromHeaders(), getSiteSettings()])
  if (!campaign) notFound()
  const companyName = getCompanyName(settings)
  const name = campaign.name || "Super Sunday"
  return buildPageMetadata({
    title: `${name} | ${companyName}`,
    description: campaign.description || `Explore ${name} at ${companyName}. Browse the products selected for this campaign and check current prices and availability.`,
    pageUrl: `${origin}/campaign/super-sunday`, origin, companyName, imageUrl: campaign.banner,
  })
}

export default async function SuperSundayLayout({ children }: { children: ReactNode }) {
  if (!await getCampaign()) notFound()
  return children
}
