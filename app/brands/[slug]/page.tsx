import { notFound } from "next/navigation"
import { getSeoBrand } from "@/lib/seo-brand"
import BrandLandingClient from "./BrandLandingClient"

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!await getSeoBrand(slug)) notFound()
  return <BrandLandingClient />
}
