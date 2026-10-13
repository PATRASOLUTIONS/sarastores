import { pageMetadata } from "@/lib/seo-page"
import BrandsClient from "./BrandsClient"

export const generateMetadata = pageMetadata({
  path: "/brands",
  title: brand => `All Brands | ${brand}`,
  description: brand => `Explore trusted electronics and appliance brands at ${brand}. Browse brand products and manufacturer warranty information.`,
})

export default function BrandsPage() {
  return <BrandsClient />
}
