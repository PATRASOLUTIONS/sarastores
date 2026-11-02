import { notFound } from "next/navigation"
import { getPublicPageCampaign } from "@/lib/public-page-data"
import CampaignClient from "./CampaignClient"
export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const campaign = await getPublicPageCampaign(slug)
  if (!campaign) notFound()
  return <CampaignClient key={slug} initialCampaign={campaign} />
}
