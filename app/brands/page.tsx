import { pageMetadata } from "@/lib/seo-page"
import BrandsClient from "./BrandsClient"
import { getPublicPageBrands, getPublicPageProducts } from "@/lib/public-page-data"

export const generateMetadata = pageMetadata({
  path: "/brands",
  title: brand => `All Brands | ${brand}`,
  description: brand => `Explore trusted electronics and appliance brands at ${brand}. Browse brand products and manufacturer warranty information.`,
})

export default async function BrandsPage() {
  const [brands, products] = await Promise.all([getPublicPageBrands(), getPublicPageProducts()])
  return <BrandsClient initialBrands={brands} initialProducts={products} />
}
