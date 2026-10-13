"use client"

import { useEffect, useState } from "react"
import CategoryProductCard from "@/components/CategoryProductCard"
import { catalogProductListResponseSchema, type CatalogProduct } from "@/utils/catalog"

/** Products merchandised alongside an article, so a guide can convert. */
export default function ArticleProductRail({ productIds }: { productIds: string[] }) {
  const [products, setProducts] = useState<CatalogProduct[]>([])

  useEffect(() => {
    setProducts([])
    if (productIds.length === 0) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: productIds }),
        })
        if (!res.ok) throw new Error("Article products could not be loaded")
        const data = catalogProductListResponseSchema.parse(await res.json())
        if (!cancelled) setProducts(data)
      } catch (error) {
        if (!cancelled) console.error("[Article products] Load failed:", error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [productIds])

  if (products.length === 0) return null

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">Products mentioned in this guide</h2>
      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <CategoryProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  )
}
