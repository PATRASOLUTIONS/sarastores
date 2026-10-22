"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { productCardResponseSchema, type ProductCardResponse } from "@/lib/product-card-response"
import { readRecentlyViewedIds, writeRecentlyViewedIds } from "@/lib/recently-viewed-client"

const LIMIT = 12

function unique(products: ProductCardResponse[]): ProductCardResponse[] {
  return [...new Map(products.map((product) => [product.id, product])).values()]
}

async function loadFromDevice(): Promise<ProductCardResponse[]> {
  const ids = readRecentlyViewedIds()
  if (!ids.length) return []
  const results = await Promise.all(ids.slice(0, LIMIT).map(async (id) => {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`)
    if (response.status === 404) return null
    if (!response.ok) throw new Error("Recently viewed product could not be loaded")
    const parsed = productCardResponseSchema.safeParse(await response.json())
    return parsed.success && parsed.data.active !== false ? parsed.data : null
  }))
  const products = unique(results.filter((product): product is ProductCardResponse => product !== null))
  const valid = new Set(products.map((product) => product.id))
  const cleaned = ids.filter((id) => valid.has(id) || !ids.slice(0, LIMIT).includes(id))
  if (cleaned.length !== ids.length) writeRecentlyViewedIds(cleaned)
  return products
}

/** Products the shopper opened most recently, newest first. */
export function useRecentlyViewed() {
  const { user, isLoading: authLoading } = useAuth()
  const [products, setProducts] = useState<ProductCardResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    let aborted = false
    const load = async () => {
      setLoading(true)
      try {
        let list: ProductCardResponse[] = []
        if (user) {
          const response = await fetch("/api/user/recently-viewed", { credentials: "include" })
          if (response.ok) {
            const body: unknown = await response.json()
            const rows = typeof body === "object" && body !== null && Array.isArray((body as { products?: unknown }).products)
              ? (body as { products: unknown[] }).products : []
            list = unique(rows.flatMap((row) => {
              const parsed = productCardResponseSchema.safeParse(row)
              return parsed.success ? [parsed.data] : []
            })).slice(0, LIMIT)
          }
        }
        if (!list.length) list = await loadFromDevice()
        if (!aborted) setProducts(list)
      } catch (error) {
        console.error("[RecentlyViewed] Could not load:", error)
        if (!aborted) setProducts([])
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    void load()
    return () => { aborted = true }
  }, [authLoading, user])

  return { products, loading }
}
