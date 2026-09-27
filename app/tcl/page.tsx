"use client"

import { useState, useEffect, useRef } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CategoryProductCard from "@/components/CategoryProductCard"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, Shield, Zap, Award, Star, Tv, Volume2, Eye, Smartphone } from "lucide-react"
import { normalizeProductForSchema } from "@/lib/product-schema"

// TCL promotional banner images
const tclBannerImages = [
    {
        url: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=1920&h=1080&fit=crop",
        alt: "TCL - Inspire Greatness",
    },
    {
        url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1920&h=1080&fit=crop",
        alt: "TCL QLED TVs - Quantum Dot Technology",
    },
    {
        url: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1920&h=1080&fit=crop",
        alt: "TCL Smart Home Entertainment",
    },
]

// TCL product categories with real product images
const tclCategoryImages = [
    {
        url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop",
        title: "QLED TV",
        description: "Quantum Dot Display",
    },
    {
        url: "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800&h=800&fit=crop",
        title: "4K UHD TV",
        description: "Ultra HD Experience",
    },
    {
        url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&h=800&fit=crop",
        title: "Smart TV",
        description: "Google TV Platform",
    },
    {
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop",
        title: "Soundbar",
        description: "Dolby Atmos Audio",
    },
    {
        url: "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800&h=800&fit=crop",
        title: "Air Conditioner",
        description: "Energy Saving",
    },
    {
        url: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800&h=800&fit=crop",
        title: "Washing Machine",
        description: "Smart Wash Technology",
    },
]

// TCL lifestyle images
const tclLifestyleImages = [
    {
        url: "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1500&h=1500&fit=crop",
        alt: "TCL Home Theater Experience",
    },
    {
        url: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=1500&h=1500&fit=crop",
        alt: "TCL Smart Living Room",
    },
]

interface Product {
    id: string
    name: string
    description?: string
    price: number
    image: string
    stock?: number
    category?: string
    rating?: number
    reviews?: number
    discount?: number
    originalPrice?: number
    specification_images?: string
    sku?: string
    technical_details?: Record<string, any>
}

export default function TCLBrandPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [currentBanner, setCurrentBanner] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [availableCategories, setAvailableCategories] = useState(tclCategoryImages)
    const heroRef = useRef<HTMLDivElement>(null)
    const productsRef = useRef<HTMLDivElement>(null)

    // Auto-rotate banner
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentBanner((prev) => (prev + 1) % tclBannerImages.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [])

    // Intersection observer for animations
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true)
                }
            },
            { threshold: 0.1 }
        )

        if (heroRef.current) {
            observer.observe(heroRef.current)
        }

        return () => observer.disconnect()
    }, [])

    // Fetch TCL products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch("/api/products")
                if (response.ok) {
                    const data = await response.json()
                    // Filter products by TCL manufacturer
                    const tclProducts = data.filter((p: any) => {
                        const manufacturer = normalizeProductForSchema(p).manufacturerName || p.manufacturer || ""
                        return manufacturer.toLowerCase().includes("tcl")
                    })
                    setProducts(tclProducts.slice(0, 12)) // Show up to 12 products

                    // Extract unique subcategories from TCL products
                    const tclSubCategories = new Set(tclProducts.map((p: any) =>
                        (p.subCategory || p.description || "").trim()
                    ))

                    // Filter our category list to only show what is available in DB
                    const validCategories = tclCategoryImages.filter(cat =>
                        Array.from(tclSubCategories).some(sub =>
                            sub && typeof sub === 'string' && sub.toLowerCase() === cat.title.toLowerCase()
                        )
                    )
                    setAvailableCategories(validCategories)
                }
            } catch (error) {
                console.error("Error fetching TCL products:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchProducts()
    }, [])

    const nextBanner = () => {
        setCurrentBanner((prev) => (prev + 1) % tclBannerImages.length)
    }

    const prevBanner = () => {
        setCurrentBanner((prev) => (prev - 1 + tclBannerImages.length) % tclBannerImages.length)
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <Header />

            {/* Hero Banner Section */}
            <section ref={heroRef} className="relative h-[60vh] md:h-[70vh] overflow-hidden">
                {/* Background gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent z-10" />

                {/* Banner Images */}
                <div className="relative h-full">
                    {tclBannerImages.map((banner, index) => (
                        <div
                            key={index}
                            className={`absolute inset-0 transition-all duration-1000 ${index === currentBanner
                                ? "opacity-100 scale-100"
                                : "opacity-0 scale-105"
                                }`}
                        >
                            <img
                                src={banner.url}
                                alt={banner.alt}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>

                {/* TCL Logo and Content */}
                <div className="absolute inset-0 z-20 flex items-center">
                    <div className="container mx-auto px-4 md:px-8">
                        <div
                            className={`max-w-2xl transition-all duration-1000 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"
                                }`}
                        >
                            {/* TCL Logo */}
                            <div className="mb-8">
                                <h1 className="text-6xl md:text-8xl font-bold text-white mb-2" style={{ fontFamily: 'Arial Black, sans-serif', letterSpacing: '0.1em' }}>
                                    TCL
                                </h1>
                                <p className="text-xl md:text-2xl text-blue-300 font-semibold">
                                    Inspire Greatness
                                </p>
                            </div>

                            <p className="text-lg md:text-xl text-white/90 mb-6 max-w-xl">
                                Experience innovation in display technology. Discover TCL's award-winning QLED TVs,
                                smart home appliances, and cutting-edge entertainment solutions.
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <Link
                                    href="/products?brands=TCL"
                                    className="group bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-600 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                                >
                                    Shop TCL Products
                                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                </Link>
                                <button className="bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-semibold border border-white/30 hover:bg-white/20 transition-all duration-300">
                                    Learn More
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Banner Navigation */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
                    <button
                        onClick={prevBanner}
                        aria-label="Previous banner"
                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    <div className="flex items-center">
                        {tclBannerImages.map((_, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => setCurrentBanner(index)}
                                aria-label={`Go to banner ${index + 1}`}
                                aria-current={index === currentBanner}
                                className="group flex h-6 min-w-[24px] items-center justify-center"
                            >
                                <span
                                    className={`h-2 rounded-full transition-all duration-300 ${index === currentBanner
                                        ? "w-8 bg-white"
                                        : "w-2 bg-white/50 group-hover:bg-white/70"
                                        }`}
                                />
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={nextBanner}
                        aria-label="Next banner"
                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </section>

            {/* Brand Features */}
            <section className="py-8 bg-gradient-to-r from-gray-900 to-gray-800">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { icon: Tv, text: "QLED Technology", color: "text-blue-400" },
                            { icon: Shield, text: "3 Year Warranty", color: "text-green-400" },
                            { icon: Volume2, text: "Dolby Atmos", color: "text-yellow-400" },
                            { icon: Award, text: "Award Winning", color: "text-purple-400" },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-center gap-3 py-4 text-white"
                            >
                                <feature.icon className={`h-6 w-6 ${feature.color}`} />
                                <span className="text-sm md:text-base font-medium">{feature.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Category Gallery Section */}
            <section className="py-16 md:py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-4">
                            Explore Categories
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            TCL Product Categories
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            From stunning QLED displays to smart home solutions, discover the complete range
                            of TCL products designed to inspire greatness in your everyday life.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                        {availableCategories.length > 0 ? (
                            availableCategories.map((category, index) => (
                                <Link
                                    href={`/products?brands=TCL&subCategory=${encodeURIComponent(category.title)}`}
                                    key={category.title}
                                    className="group relative bg-gray-50 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-500 transform hover:-translate-y-2"
                                >
                                    <div className="aspect-square overflow-hidden">
                                        <img
                                            src={category.url}
                                            alt={category.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    </div>

                                    {/* Gradient overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                                    {/* Content */}
                                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                        <h3 className="text-lg font-bold mb-1">{category.title}</h3>
                                        <p className="text-sm text-white/80">{category.description}</p>
                                        <div className="flex items-center mt-2 text-sm text-blue-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            Shop Now <ArrowRight className="ml-1 h-4 w-4" />
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="col-span-full text-center text-gray-500 py-8">
                                No specific product categories found.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Why Choose TCL Section */}
            <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Why Choose TCL?
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Global leader in consumer electronics and entertainment technology
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Eye,
                                title: "Visual Excellence",
                                description: "Industry-leading QLED and Mini-LED display technology for stunning picture quality",
                            },
                            {
                                icon: Smartphone,
                                title: "Smart Integration",
                                description: "Seamless connectivity with Google TV and voice control for effortless entertainment",
                            },
                            {
                                icon: Sparkles,
                                title: "Innovation First",
                                description: "Cutting-edge features and technologies at accessible prices",
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
                            >
                                <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center mb-6">
                                    <feature.icon className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                                <p className="text-gray-600">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* TCL Products Section */}
            <section ref={productsRef} className="py-16 md:py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-semibold mb-4">
                            Featured Products
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Shop TCL Products
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Discover our selection of TCL products with cutting-edge display technology
                            and smart features.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                            </div>
                        </div>
                    ) : products.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {products.map((product) => (
                                    <CategoryProductCard key={product.id} product={product} />
                                ))}
                            </div>

                            <div className="text-center mt-12">
                                <Link
                                    href="/products?brands=TCL"
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                                >
                                    View All TCL Products
                                    <ArrowRight className="h-5 w-5" />
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-16">
                            <div className="mb-6">
                                <Tv className="h-16 w-16 mx-auto text-gray-300" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                TCL Products Coming Soon
                            </h3>
                            <p className="text-gray-500 mb-6">
                                We're adding TCL products to our collection. Check back soon!
                            </p>
                            <Link
                                href="/products"
                                className="inline-flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all"
                            >
                                Browse All Products
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                        </div>
                    )}
                </div>
            </section>

            {/* Trust Badges Section */}
            <section className="py-12 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900">
                <div className="container mx-auto px-4">
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                                <Star className="h-6 w-6 text-blue-300" />
                            </div>
                            <div>
                                <div className="font-bold text-lg">World's #2</div>
                                <div className="text-sm text-blue-200">TV Brand Globally</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center">
                                <Shield className="h-6 w-6 text-green-300" />
                            </div>
                            <div>
                                <div className="font-bold text-lg">3 Year Warranty</div>
                                <div className="text-sm text-blue-200">On Select Models</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-yellow-600/20 flex items-center justify-center">
                                <Award className="h-6 w-6 text-yellow-300" />
                            </div>
                            <div>
                                <div className="font-bold text-lg">CES Awards</div>
                                <div className="text-sm text-blue-200">Innovation Winner</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    )
}
