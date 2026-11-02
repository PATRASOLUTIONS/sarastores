import { getPublicPageCategories, getPublicPageProducts } from "@/lib/public-page-data"
import ProductsClient from "./ProductsClient"

export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getPublicPageProducts(), getPublicPageCategories()])
  return <ProductsClient initialProducts={products} initialCategories={categories} />
}
