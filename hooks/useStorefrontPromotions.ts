"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { useAuth } from "@/contexts/AuthContext"
import { apiFetchJson } from "@/lib/api-client"
import { storefrontPromotionsSchema, visiblePromotionProducts } from "@/lib/storefront-promotion-types"

export function useStorefrontPromotions(productId?: string) {
  const { user, isLoading } = useAuth()
  const endpoint = `/api/storefront-promotions${productId ? `?productId=${encodeURIComponent(productId)}` : ""}`
  const { data, error } = useSWR(isLoading ? null : [endpoint, user?.id || "guest"],
    ([url]) => apiFetchJson(url, undefined, value => storefrontPromotionsSchema.parse(value)),
    { refreshInterval: 30000, revalidateOnFocus: true, keepPreviousData: false, shouldRetryOnError: false, dedupingInterval: 2000 })
  const baseline = useMemo(() => data ? { verified: Date.parse(data.verifiedAt), received: performance.now() } : null, [data])
  const [, tick] = useState(0)
  useEffect(() => {
    if (!data) return
    const timer = window.setInterval(() => tick(value => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [data])
  // Server time plus monotonic elapsed time handles client clock skew and expiry.
  const products = data && baseline && !error && !isLoading
    ? visiblePromotionProducts(data, baseline.verified + performance.now() - baseline.received) : []
  return { products, loading: !data && !error, error: !!error }
}
