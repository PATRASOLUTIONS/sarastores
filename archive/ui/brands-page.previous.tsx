"use client"

import { useState, useEffect } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"

interface Brand {
    _id: string
    name: string
    slug: string
    tagline?: string
    description?: string
    accentColor: string
    banners: { url: string; alt: string }[]
    logo?: string
}

const accentBgMap: Record<string, string> = {
    blue: "from-blue-600 to-blue-500",
    red: "from-red-600 to-red-500",
    green: "from-green-600 to-green-500",
    purple: "from-purple-600 to-purple-500",
    orange: "from-orange-600 to-orange-500",
    yellow: "from-yellow-600 to-yellow-500",
    pink: "from-pink-600 to-pink-500",
    indigo: "from-indigo-600 to-indigo-500",
    teal: "from-teal-600 to-teal-500",
    cyan: "from-cyan-600 to-cyan-500",
    gray: "from-gray-600 to-gray-500",
}

export default function BrandsIndexPage() {
    const [brands, setBrands] = useState<Brand[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchBrands = async () => {
            try {
                const res = await fetch("/api/brands?enabledOnly=true&landingPagesOnly=true")
                const data = await res.json()
                if (data.success) {
                    setBrands(data.brands)
                }
            } catch (error) {
                console.error("Failed to fetch brands:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchBrands()
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <Header />

            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        Our Brands
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Explore our curated collection of world-class brands. Each brand page
                        features exclusive products, categories, and special offers.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
                    </div>
                ) : brands.length === 0 ? (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
                            No brands available
                        </h2>
                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand-primary-hover transition-all"
                        >
                            Browse All Products
                            <ArrowRight className="h-5 w-5" />
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {brands.map((brand) => (
                            <Link
                                key={brand._id}
                                href={`/brands/${brand.slug}`}
                                className="group relative bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2"
                            >
                                {/* Banner Image */}
                                <div className="h-48 overflow-hidden relative">
                                    {brand.banners?.[0]?.url ? (
                                        <img
                                            src={brand.banners[0].url}
                                            alt={brand.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div
                                            className={`w-full h-full bg-gradient-to-r ${
                                                accentBgMap[brand.accentColor] ||
                                                "from-blue-600 to-blue-500"
                                            }`}
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                                    {/* Brand Name on Image */}
                                    <div className="absolute bottom-4 left-4">
                                        {brand.logo ? (
                                            <img
                                                src={brand.logo}
                                                alt={brand.name}
                                                className="h-10 object-contain"
                                            />
                                        ) : (
                                            <h2 className="text-2xl font-bold text-white">
                                                {brand.name}
                                            </h2>
                                        )}
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    {brand.tagline && (
                                        <p className="text-sm text-gray-500 italic mb-2">
                                            "{brand.tagline}"
                                        </p>
                                    )}
                                    {brand.description && (
                                        <p className="text-gray-600 text-sm line-clamp-2 mb-4">
                                            {brand.description}
                                        </p>
                                    )}
                                    <div className="flex items-center text-brand-primary font-semibold text-sm group-hover:text-brand-primary-hover transition-colors">
                                        Explore {brand.name}
                                        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            <Footer />
        </div>
    )
}
