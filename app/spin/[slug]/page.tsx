import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { SpinWheelPageWithCampaign } from "../page"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (slug === "default") {
    return { title: "Spin & Win | Sara Electronics" }
  }
  return { title: `Spin & Win - ${slug.replace(/-/g, " ")} | Sara Electronics` }
}

export default async function SpinCampaignPage({ params }: Props) {
  const { slug } = await params

  if (!slug || slug.length > 60) notFound()

  return <SpinWheelPageWithCampaign campaignId={slug} />
}
