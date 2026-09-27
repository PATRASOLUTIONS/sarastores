import type React from "react"
import type { Metadata } from "next"
import { getCollection } from "@/lib/db-service"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"

async function getCampaign(slug: string) {
  try {
    const collection = await getCollection("campaign_pages")
    return await collection.findOne({ slug })
  } catch {
    return null
  }
}

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

  const companyName = getCompanyName(settings)
  const name = campaign?.name || slug.replace(/-/g, " ")

  return buildPageMetadata({
    title: `${name} | ${companyName}`,
    description:
      campaign?.description ||
      `${name} at ${companyName} — limited-period offers on televisions, home appliances and mobiles with no-cost EMI, bank discounts and free installation.`,
    pageUrl: `${origin}/campaign/${slug}`,
    origin,
    companyName,
    imageUrl: campaign?.banner || undefined,
    // An expired or missing campaign is a thin page; keep it out of the index.
    noIndex: !campaign || campaign.isActive === false,
  })
}

export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
