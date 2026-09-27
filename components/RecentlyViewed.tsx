"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import CategoryProductCard from "@/components/CategoryProductCard"

interface Product {
    id: string
    slug?: string
    name: string
    price: number
    image: string
    // Add other necessary fields
}

interface RecentlyViewedProps {
    /** Hide the current product (so it doesn't appear in its own list). */
    excludeId?: string
    /** Optional override title. */
    title?: string
}

export default function RecentlyViewed({ excludeId, title = "Recently Viewed" }: RecentlyViewedProps) {
    const { user } = useAuth()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        let aborted = false
        const fetchRecentlyViewed = async () => {
            setLoading(true)
            try {
                if (user) {
                    // Fetch from DB — single API call
                    const res = await fetch(`/api/user/recently-viewed?userId=${(user as any)._id || user.id}`)
                    if (res.ok && !aborted) {
                        const data = await res.json()
                        const fetched = (data.products || []).slice(0, 16)
                        // Deduplicate by id/_id to avoid duplicate keys
                        const uniqueProducts: Product[] = []
                        const seen = new Set<string>()
                        fetched.forEach((p: any) => {
                            const id = p?.id ?? p?._id
                            const sid = id ? String(id) : JSON.stringify(p)
                            if (!seen.has(sid)) {
                                seen.add(sid)
                                uniqueProducts.push(p)
                            }
                        })
                        setProducts(uniqueProducts.slice(0, 8))
                    }
                } else {
                    // Fetch from LocalStorage — batch into parallel fetches (max 8)
                    const rawIds: string[] = JSON.parse(localStorage.getItem("recently_viewed_ids") || "[]")
                    // Deduplicate IDs just in case
                    const recentIds = Array.from(new Set(rawIds))

                    if (recentIds.length === 0) {
                        setProducts([])
                        setLoading(false)
                        return
                    }

                    const promises = recentIds.slice(0, 12).map((id: string) =>
                        fetch(`/api/products/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)
                    )
                    const results = await Promise.all(promises)
                    if (!aborted) {
                        const validProducts = results.filter(Boolean)
                        // Final deduplication by ID to prevent duplicate keys
                        const uniqueProducts: Product[] = []
                        const seenIds = new Set()

                        validProducts.forEach(p => {
                            const id = (p as any).id || (p as any)._id
                            if (id && !seenIds.has(String(id))) {
                                seenIds.add(String(id))
                                uniqueProducts.push(p)
                            }
                        })

                        setProducts(uniqueProducts)

                        // Clean up stale IDs (404/deleted products) from localStorage
                        const validIds = new Set(uniqueProducts.map(p => String(p.id || (p as any)._id)))
                        const cleanedIds = recentIds.filter(id => validIds.has(id))
                        if (cleanedIds.length !== recentIds.length) {
                            localStorage.setItem("recently_viewed_ids", JSON.stringify(cleanedIds))
                        }
                    }
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchRecentlyViewed()
        return () => { aborted = true }
    }, [user])

    const filtered = excludeId
        ? products.filter((p: any) => String(p.id ?? p._id) !== String(excludeId))
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
                        const id = (product as any)?.id ?? (product as any)?._id ?? `recent-${idx}`
                        const key = `${String(id)}-${idx}`
                        return (
                            <div key={key} className="min-w-[180px] w-[180px] md:min-w-[220px] md:w-[220px]">
                                <CategoryProductCard product={product as any} />
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
