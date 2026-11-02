import BrandClient from "./BrandClient"
import { getPublicPageProducts } from "@/lib/public-page-data"
import { catalogueBrand } from "@/lib/product-metadata-sheet"
import { brandProductListResponseSchema } from "@/lib/brand-landing-response"

export const dynamic = "force-dynamic"

export default async function TCLBrandPage() {
  const products = (await getPublicPageProducts()).filter(product => product.price > 0 &&
    catalogueBrand(product).toLowerCase().includes("tcl"))
  return <BrandClient initialProducts={brandProductListResponseSchema.parse(products.slice(0, 12))} />
}
