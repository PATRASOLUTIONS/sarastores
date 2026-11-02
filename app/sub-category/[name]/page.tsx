import { notFound } from "next/navigation"
import { getPublicPageCategories, getPublicPageProducts, getPublicPageSubCategories } from "@/lib/public-page-data"
import { normalizeProductForSchema } from "@/lib/product-schema"
import { subCategoryProductResponseSchema } from "@/lib/product-card-response"
import SubCategoryClient from "./SubCategoryClient"
export default async function SubCategoryPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const decoded = decodeURIComponent(name)
  const category = (await getPublicPageSubCategories()).find(item => item.slug === decoded || item.name.toLowerCase() === decoded.toLowerCase() || item.name.toLowerCase() === decoded.replace(/-/g, " ").toLowerCase())
  if (!category) notFound()
  const products = (await getPublicPageProducts()).filter(product => String(product.subCategory || normalizeProductForSchema(product).subCategoryProdDesc || "").toLowerCase() === category.name.toLowerCase()).map(product => subCategoryProductResponseSchema.parse(product))
  return <SubCategoryClient key={name} initialName={category.name} initialProducts={products} initialCategories={await getPublicPageCategories()} />
}
