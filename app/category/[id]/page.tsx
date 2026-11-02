import { notFound } from "next/navigation"
import { getPublicPageCategories, getPublicPageProducts } from "@/lib/public-page-data"
import CategoryClient from "./CategoryClient"

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const categories = await getPublicPageCategories()
  const identifier = decodeURIComponent(id)
  const category = categories.find(item => item.id === identifier || item.slug === identifier ||
    item.name.toLowerCase() === identifier.replace(/-/g, " ").toLowerCase() || item.name.toLowerCase() === identifier.toLowerCase())
  if (!category) notFound()
  const products = (await getPublicPageProducts()).filter(product =>
    String(product.category || "").trim().toLowerCase() === category.name.trim().toLowerCase() ||
    String(product.groupName || "").trim().toLowerCase() === category.name.trim().toLowerCase() || product.category === category.id)
  return <CategoryClient key={id} initialCategory={category} initialCategories={categories} initialProducts={products} />
}
