import { notFound } from "next/navigation"
import { getSeoBrand } from "@/lib/seo-brand"
import BrandLandingClient from "./BrandLandingClient"
import { getPublicPageProducts } from "@/lib/public-page-data"
import { brandLandingResponseSchema } from "@/lib/brand-landing-response"
import { catalogueBrand } from "@/lib/product-metadata-sheet"

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const record = await getSeoBrand(slug)
  if (!record) notFound()
  const brand = brandLandingResponseSchema.parse(record)
  const products = (await getPublicPageProducts()).filter(product => catalogueBrand(product).toLowerCase()
    .includes((brand.productsSection.manufacturerFilter || brand.name).toLowerCase())).slice(0, brand.productsSection.maxProducts)
  return <BrandLandingClient key={slug} initialBrand={brand} initialProducts={products} />
}
