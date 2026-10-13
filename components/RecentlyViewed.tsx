"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import CategoryProductCard from "@/components/CategoryProductCard"
import { productCardResponseSchema, recentlyViewedResponseSchema, type ProductCardResponse } from "@/lib/product-card-response"
import { z } from "zod"

interface RecentlyViewedProps {
    /** Hide the current product (so it doesn't appear in its own list). */
    excludeId?: string
    /** Optional override title. */
    title?: string
}

export default function RecentlyViewed({ excludeId, title = "Recently Viewed" }: RecentlyViewedProps) {
    const { user } = useAuth()
    const [products, setProducts] = useState<ProductCardResponse[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let aborted = false
        const fetchRecentlyViewed = async () => {
            setLoading(true)
            try {
                if (user) {
                    // Fetch from DB — single API call
                    const res = await fetch("/api/user/recently-viewed")
                    if (!res.ok) throw new Error("Recently viewed products could not be loaded")
                    if (res.ok && !aborted) {
                        const data = recentlyViewedResponseSchema.parse(await res.json())
                        const fetched = data.products.slice(0, 16)
                        const uniqueProducts: ProductCardResponse[] = []
                        const seen = new Set<string>()
                        fetched.forEach((p) => {
                            const sid = p.id
                            if (!seen.has(sid)) {
                                seen.add(sid)
                                uniqueProducts.push(p)
                            }
                        })
                        setProducts(uniqueProducts.slice(0, 8))
                    }
                } else {
                    // Fetch from LocalStorage — batch into parallel fetches (max 8)
                    const rawIds = z.array(z.string()).parse(JSON.parse(localStorage.getItem("recently_viewed_ids") || "[]"))
                    // Deduplicate IDs just in case
                    const recentIds = Array.from(new Set(rawIds))

                    if (recentIds.length === 0) {
                        setProducts([])
                        setLoading(false)
                        return
                    }

                    const promises = recentIds.slice(0, 12).map(async (id) => {
                        const response = await fetch(`/api/products/${encodeURIComponent(id)}`)
                        if (response.status === 404) return null
                        if (!response.ok) throw new Error("Recently viewed product could not be loaded")
                        return productCardResponseSchema.parse(await response.json())
                    })
                    const results = await Promise.all(promises)
                    if (!aborted) {
                        const validProducts = results.filter((product) => product !== null)
                        // Final deduplication by ID to prevent duplicate keys
                        const uniqueProducts: ProductCardResponse[] = []
                        const seenIds = new Set<string>()

                        validProducts.forEach(p => {
                            const id = p.id
                            if (!seenIds.has(id)) {
                                seenIds.add(id)
                                uniqueProducts.push(p)
                            }
                        })

                        setProducts(uniqueProducts)

                        // Clean up stale IDs (404/deleted products) from localStorage
                        const validIds = new Set(uniqueProducts.map(p => p.id))
                        const cleanedIds = recentIds.filter(id => validIds.has(id))
                        if (cleanedIds.length !== recentIds.length) {
                            localStorage.setItem("recently_viewed_ids", JSON.stringify(cleanedIds))
                        }
                    }
                }
            } catch (err) {
                console.error(err)
            } finally {
                if (!aborted) setLoading(false)
            }
        }
        fetchRecentlyViewed()
        return () => { aborted = true }
    }, [user])

    const filtered = excludeId
        ? products.filter((p) => p.id !== String(excludeId))
        : products

    if (filtered.length === 0) return null

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            <div className="mb-5">
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">{title}</h2>
                <p className="text-sm text-gray-500 mt-1">Pick up where you left off</p>
            </div>

            {loading ? (
                <div className="flex gap-4 overflow-hidden">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="min-w-[160px] md:min-w-[200px] h-64 bg-gray-100 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : (
                <div className="flex overflow-x-auto gap-4 pb-2 scrollbar-hide -mx-2 px-2">
                    {filtered.map((product, idx) => {
                        const key = `${product.id}-${idx}`
                        return (
                            <div key={key} className="min-w-[180px] w-[180px] md:min-w-[220px] md:w-[220px]">
                                <CategoryProductCard product={product} />
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
