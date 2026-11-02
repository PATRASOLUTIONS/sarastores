import { notFound } from "next/navigation"
import CampaignExperience from "@/components/CampaignExperience"
import { getPublicPageCampaign } from "@/lib/public-page-data"

export const dynamic = "force-dynamic"

export default async function SuperSundayPage() {
  const campaign = await getPublicPageCampaign("super-sunday")
  if (!campaign) notFound()
  return <CampaignExperience key={campaign.slug} fixedSlug="super-sunday" initialCampaign={campaign} />
}
