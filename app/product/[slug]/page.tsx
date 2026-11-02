import { notFound } from "next/navigation"
import { getPublicPageProduct } from "@/lib/public-page-data"
import ProductDetailClient from "./ProductDetailClient"

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getPublicPageProduct(slug)
  if (!product) notFound()
  return <ProductDetailClient key={slug} initialProduct={product} />
}
