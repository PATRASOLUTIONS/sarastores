import type React from "react"
import type { Metadata } from "next"
import { getCollection } from "@/lib/db-service"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"
import { notFound } from "next/navigation"
import { cache } from "react"

const getCampaign = cache(async (slug: string) => {
  const collection = await getCollection("campaign_pages")
  return collection.findOne({ slug: decodeURIComponent(slug), isActive: true })
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const [origin, settings, campaign] = await Promise.all([
    getOriginFromHeaders(),
    getSiteSettings(),
    getCampaign(slug),
  ])
  if (!campaign) notFound()

  const companyName = getCompanyName(settings)
  const name = campaign?.name || slug.replace(/-/g, " ")

  return buildPageMetadata({
    title: `${name} | ${companyName}`,
    description:
      campaign?.description ||
      `Explore ${name} at ${companyName}. Browse the products selected for this campaign and check current prices and availability.`,
    pageUrl: `${origin}/campaign/${encodeURIComponent(campaign.slug)}`,
    origin,
    companyName,
    imageUrl: campaign?.banner || undefined,
  })
}

export default async function CampaignLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!await getCampaign(slug)) notFound()
  return <>{children}</>
}
