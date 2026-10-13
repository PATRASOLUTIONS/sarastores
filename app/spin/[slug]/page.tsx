import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SpinWheelPageWithCampaign } from "../SpinWheelClient"
import { buildPageMetadata, getCompanyName, getOriginFromHeaders, getSiteSettings } from "@/lib/seo-metadata"
import { findCampaignBySlug } from "@/lib/spin-wheel-campaigns"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound()
  const [origin, settings, campaign] = await Promise.all([
    getOriginFromHeaders(), getSiteSettings(), findCampaignBySlug(slug),
  ])
  if (!campaign && slug !== "default") notFound()
  const companyName = getCompanyName(settings)
  return buildPageMetadata({
    title: `${campaign?.name || "Spin & Win"} | ${companyName}`,
    description: campaign?.description || "Check this SARA Spin & Win campaign's participation rules, eligibility and prize-collection terms.",
    pageUrl: `${origin}/spin/${slug}`, origin, companyName, noIndex: true,
  })
}

export default async function SpinCampaignPage({ params }: Props) {
  const { slug } = await params

  if (!slug || slug.length > 60) notFound()

  return <SpinWheelPageWithCampaign campaignId={slug} />
}
