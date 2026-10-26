"use client"

import { z } from "zod"
import { activeBrandListResponseSchema } from "@/lib/catalog-list-response"

export type ActiveProductBrand = { name: string; count: number }
const productBrandsSchema = z.array(z.object({
  active: z.boolean().optional(),
  stock: z.union([z.number(), z.string()]).nullish(),
  manufacturerName: z.string().nullish(),
  manufacturer_name: z.string().nullish(),
  brand: z.string().nullish(),
}))
const TTL = 2 * 60 * 1000
let cached: { brands: ActiveProductBrand[]; expiresAt: number } | null = null
let pending: Promise<ActiveProductBrand[]> | null = null

async function catalogueBrands(): Promise<ActiveProductBrand[]> {
  const brands = new Map<string, ActiveProductBrand>()
  let skip = 0
  while (true) {
    const response = await fetch(`/api/products?fields=card&inStock=true&limit=1000&skip=${skip}`, {
      cache: "no-store", signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error("Active product brands could not be loaded")
    const products = productBrandsSchema.parse(await response.json())
    for (const product of products) {
      const stock = Number(product.stock)
      if (product.active !== true || !Number.isFinite(stock) || stock <= 0) continue
      const name = [product.manufacturerName, product.manufacturer_name, product.brand]
        .map(value => value?.trim() || "").find(Boolean)
      if (!name) continue
      const key = name.toLowerCase()
      const existing = brands.get(key)
      if (existing) existing.count++
      else brands.set(key, { name, count: 1 })
    }
    skip += products.length
    const more = response.headers.get("X-Has-More")
    if (more === "false" || (more === null && products.length < 1000)) break
    if (!products.length) throw new Error("Active product catalogue could not be loaded completely")
  }
  return [...brands.values()].sort((a, b) => a.name.localeCompare(b.name))
}

async function loadBrands(): Promise<ActiveProductBrand[]> {
  try {
    const response = await fetch("/api/brands/in-stock", {
      cache: "no-store", signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error("Active brand endpoint is unavailable")
    return activeBrandListResponseSchema.parse(await response.json()).brands.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    // Use the public catalogue if the aggregation route times out, fails,
    // or has not reached a deployment that already serves this header.
    return catalogueBrands()
  }
}

// Only brands with active, in-stock products appear in either header menu.
// Share in-flight requests without relying on a persisted browser-cache shape.
export function fetchActiveProductBrands(force = false): Promise<ActiveProductBrand[]> {
  if (pending) return pending
  if (!force && cached && Date.now() < cached.expiresAt) return Promise.resolve(cached.brands)
  pending = loadBrands().then(brands => {
    cached = { brands, expiresAt: Date.now() + TTL }
    return brands
  }).finally(() => { pending = null })
  return pending
}
