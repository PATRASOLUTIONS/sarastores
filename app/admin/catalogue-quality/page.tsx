import { redirect } from "next/navigation"
import { requireFullAdmin } from "@/lib/auth"
import { pageMetadata } from "@/lib/seo-page"
import CatalogueQualityClient from "./catalogue-quality-client"

export const generateMetadata = pageMetadata({ path: "/admin/catalogue-quality", title: "Catalogue Quality", description: "Private catalogue quality review and approved missing-data imports.", noIndex: true })
export default async function CatalogueQualityPage() {
  const guard = await requireFullAdmin()
  if (!guard.ok) redirect("/admin/dashboard")
  return <CatalogueQualityClient />
}
