'use client'

import { useEffect, useRef } from 'react'
import { fetchWithCache, prefetch, revalidateCache } from '@/utils/cache'

const PRODUCTS_TTL = 5 * 60 * 1000 // 5 minutes

interface HomeComponent {
  id: string
  type: 'category' | 'manual'
  title?: string
  enabled: boolean
  config?: {
    categoryId?: string
    productIds?: string[]
  }
}

/**
 * Given homeComponents config, prefetch all category product data in parallel.
 * Returns a map of componentId → products[] that updates as data arrives.
 */
export function usePrefetchHomeProducts(
  homeComponents: HomeComponent[],
  onCategoryProducts: (map: Record<string, any[]>) => void,
  onManualProducts: (map: Record<string, any[]>) => void,
) {
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!homeComponents || homeComponents.length === 0) return
    if (hasRunRef.current) return
    hasRunRef.current = true

    const categoryBlocks = homeComponents.filter(
      c => c.enabled && c.type === 'category' && c.config?.categoryId
    )
    const manualBlocks = homeComponents.filter(
      c =>
        c.enabled &&
        c.type === 'manual' &&
        Array.isArray(c.config?.productIds) &&
        (c.config?.productIds?.length ?? 0) > 0
    )

    // ─── Prefetch category products in parallel ──────────────────────
    if (categoryBlocks.length > 0) {
      const categoryMap: Record<string, any[]> = {}

      Promise.all(
        categoryBlocks.map(async (block) => {
          const catId = block.config!.categoryId!
          const cacheKey = `cat-products-${catId}`
          const fetcher = () =>
            fetch(`/api/products?category=${catId}&limit=10`).then(r => {
              if (!r.ok) throw new Error('Failed')
              return r.json()
            })

          try {
            const products = await fetchWithCache(cacheKey, fetcher, PRODUCTS_TTL)
            categoryMap[catId] = products
            // Background revalidate
            revalidateCache(cacheKey, fetcher, PRODUCTS_TTL)
          } catch {
            categoryMap[catId] = []
          }
        })
      ).then(() => {
        onCategoryProducts(categoryMap)
      })
    }

    // ─── Prefetch manual product blocks in parallel ──────────────────
    if (manualBlocks.length > 0) {
      const manualMap: Record<string, any[]> = {}

      Promise.all(
        manualBlocks.map(async (block) => {
          const ids: string[] = block.config!.productIds!
          try {
            const products = await Promise.all(
              ids.map(id =>
                fetchWithCache(
                  `product-${id}`,
                  () =>
                    fetch(`/api/products/${encodeURIComponent(id)}`).then(r => {
                      if (!r.ok) throw new Error('Failed')
                      return r.json()
                    }),
                  PRODUCTS_TTL
                ).catch(() => null)
              )
            )
            manualMap[block.id] = products.filter(Boolean)
            // Revalidate in background
            ids.forEach(id =>
              revalidateCache(
                `product-${id}`,
                () =>
                  fetch(`/api/products/${encodeURIComponent(id)}`).then(r => {
                    if (!r.ok) throw new Error('Failed')
                    return r.json()
                  }),
                PRODUCTS_TTL
              )
            )
          } catch {
            manualMap[block.id] = []
          }
        })
      ).then(() => {
        onManualProducts(manualMap)
      })
    }
  }, [homeComponents, onCategoryProducts, onManualProducts])
}
