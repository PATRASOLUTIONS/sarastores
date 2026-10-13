'use client'

import { useEffect, useRef } from 'react'
import { fetchWithCache, revalidateCache } from '@/utils/cache'
import { catalogProductResponseSchema, catalogProductListResponseSchema, type CatalogProduct } from '@/utils/catalog'
import { z } from 'zod'
import type { HomeSection as HomeComponent } from '@/lib/home-components-client'

export { homeSectionResponseSchema as homeComponentResponseSchema } from '@/lib/home-components-client'
export type { HomeComponent }

const PRODUCTS_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Given homeComponents config, prefetch all category product data in parallel.
 * Returns a map of componentId → products[] that updates as data arrives.
 */
export function usePrefetchHomeProducts(
  homeComponents: HomeComponent[],
  onCategoryProducts: (map: Record<string, CatalogProduct[]>) => void,
  onManualProducts: (map: Record<string, CatalogProduct[]>) => void,
) {
  const hasRunRef = useRef(false)

  useEffect(() => {
    if (!homeComponents || homeComponents.length === 0) return
    if (hasRunRef.current) return
    hasRunRef.current = true

    const categoryBlocks = homeComponents.filter(c => c.type === 'category').filter(
      c => c.enabled && c.config.categoryId
    )
    const manualBlocks = homeComponents.filter(c => c.type === 'manual').filter(
      c =>
        c.enabled &&
        Array.isArray(c.config?.productIds) &&
        (c.config?.productIds?.length ?? 0) > 0
    )

    // ─── Prefetch category products in parallel ──────────────────────
    if (categoryBlocks.length > 0) {
      const categoryMap: Record<string, CatalogProduct[]> = {}

      Promise.all(
        categoryBlocks.map(async (block) => {
          const catId = block.config.categoryId
          const cacheKey = `cat-products-${catId}`
          const fetcher = () =>
            fetch(`/api/products?category=${catId}&limit=10`).then(async r => {
              if (!r.ok) throw new Error('Failed')
              return z.array(catalogProductResponseSchema).parse(await r.json())
            })

          try {
            const products = await fetchWithCache(cacheKey, fetcher, catalogProductListResponseSchema, PRODUCTS_TTL)
            categoryMap[catId] = products
            // Background revalidate
            revalidateCache(cacheKey, fetcher, catalogProductListResponseSchema)
          } catch (error) {
            console.error('Failed to load homepage category products', error)
            categoryMap[catId] = []
          }
        })
      ).then(() => {
        onCategoryProducts(categoryMap)
      })
    }

    // ─── Prefetch manual product blocks in parallel ──────────────────
    if (manualBlocks.length > 0) {
      const manualMap: Record<string, CatalogProduct[]> = {}

      Promise.all(
        manualBlocks.map(async (block) => {
          const ids = block.config.productIds
          try {
            const products = await Promise.all(
              ids.map(id =>
                fetchWithCache(
                  `product-${id}`,
                  () =>
                    fetch(`/api/products/${encodeURIComponent(id)}`).then(async r => {
                      if (!r.ok) throw new Error('Failed')
                      return catalogProductResponseSchema.parse(await r.json())
                    }),
                  catalogProductResponseSchema,
                  PRODUCTS_TTL
                ).catch(error => {
                  console.error('Failed to load homepage manual product', error)
                  return null
                })
              )
            )
            manualMap[block.id] = products.filter((product): product is CatalogProduct => product !== null)
            // Revalidate in background
            ids.forEach(id =>
              revalidateCache(
                `product-${id}`,
                () =>
                  fetch(`/api/products/${encodeURIComponent(id)}`).then(async r => {
                    if (!r.ok) throw new Error('Failed')
                    return catalogProductResponseSchema.parse(await r.json())
                  }),
                catalogProductResponseSchema
              )
            )
          } catch (error) {
            console.error('Failed to load homepage manual products', error)
            manualMap[block.id] = []
          }
        })
      ).then(() => {
        onManualProducts(manualMap)
      })
    }
  }, [homeComponents, onCategoryProducts, onManualProducts])
}
