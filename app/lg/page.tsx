"use client"

import { useState, useEffect, useRef } from "react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CategoryProductCard from "@/components/CategoryProductCard"
import Link from "next/link"
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles, Shield, Zap, Award, Star, X, Grid, ZoomIn } from "lucide-react"
import { lgLifestyleGalleryImages } from "./data"
import { motion, AnimatePresence } from "framer-motion"
import { normalizeProductForSchema } from "@/lib/product-schema"

// LG promotional images from Amazon
const lgBannerImages = [
    {
        url: "https://m.media-amazon.com/images/S/abs-image-upload-na/0/AmazonStores/A21TJRUUN4KGV/1852ccad4137d9fcf49d884385000d0e.w3000.h1500._CR0%2C0%2C3000%2C1500_SX1500_.jpg",
        alt: "LG OLED evo AI - Experience the Future of Television",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/d8cb0d7d-0bd4-421b-a557-9b6b3e2a73cd._CR0%2C0%2C3000%2C1500_SX3000_.jpg",
        alt: "LG Life's Good - Innovation for a Better Life",
    },
    {
        url: "https://m.media-amazon.com/images/S/abs-image-upload-na/c/AmazonStores/A21TJRUUN4KGV/f7906c58e5f20426fd88ff390b34a37f.w1500.h750._CR0%2C0%2C1500%2C750_SX1500_.jpg",
        alt: "LG Premium Home Appliances",
    },
]

// LG Category promotional images
// LG Category promotional images
const lgCategoryImages = [
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/72510544-c601-4695-910e-d8eac71dfddd._CR0%2C0%2C760%2C760_SX375_SY375_.jpg",
        title: "Refrigerator",
        description: "Smart Inverter Technology",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/475b151d-d174-4648-bcea-bdd8fb6e1e5a._CR0%2C0%2C760%2C760_SX375_SY375_.jpg",
        title: "Washing machine",
        description: "AI Direct Drive",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/bb19f379-7728-488a-a271-423e7cfe4417._CR0%2C0%2C760%2C760_SX375_SY375_.jpg",
        title: "Dishwasher",
        description: "QuadWash Technology",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/97c2a4f5-fab8-4b84-96bc-00d4d6295b7d._CR0%2C0%2C760%2C760_SX375_SY375_.jpg",
        title: "Tv 55",
        description: "OLED & QNED Display",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/97c2a4f5-fab8-4b84-96bc-00d4d6295b7d._CR0%2C0%2C760%2C760_SX375_SY375_.jpg",
        title: "Tv 65",
        description: "Cinematic Experience",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/97c2a4f5-fab8-4b84-96bc-00d4d6295b7d._CR0%2C0%2C760%2C760_SX375_SY375_.jpg",
        title: "Tv 50",
        description: "4K Smart TV",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/97c2a4f5-fab8-4b84-96bc-00d4d6295b7d._CR0%2C0%2C760%2C760_SX375_SY375_.jpg",
        title: "Tv 32",
        description: "HD LED Smart TV",
    },
]

// Additional lifestyle images
const lgLifestyleImages = [
    {
        url: "https://m.media-amazon.com/images/S/abs-image-upload-na/3/AmazonStores/A21TJRUUN4KGV/f4f3d925f2d119708c50ef25dc21354b.w1500.h1500._CR0%2C0%2C1500%2C1500_SX750_SY750_.jpg",
        alt: "LG Smart Home Laundry Solutions",
    },
    {
        url: "https://m.media-amazon.com/images/S/al-eu-726f4d26-7fdb/50148a87-0736-452b-9d6c-9e7240d4029a._CR0%2C0%2C1600%2C1600_SX1500_.jpg",
        alt: "LG Smart Home Entertainment",
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

export default function LGBrandPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [currentBanner, setCurrentBanner] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [isGalleryOpen, setIsGalleryOpen] = useState(false)
    const [selectedImage, setSelectedImage] = useState<string | null>(null)
    const [availableCategories, setAvailableCategories] = useState(lgCategoryImages)
    const heroRef = useRef<HTMLDivElement>(null)
    const productsRef = useRef<HTMLDivElement>(null)

    // Auto-rotate banner
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentBanner((prev) => (prev + 1) % lgBannerImages.length)
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

    // Fetch LG products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch("/api/products")
                if (response.ok) {
                    const data = await response.json()
                    // Filter products by LG manufacturer
                    const lgProducts = data.filter((p: any) => {
                        const manufacturer = normalizeProductForSchema(p).manufacturerName || p.manufacturer || ""
                        return manufacturer.toLowerCase().includes("lg")
                    })
                    setProducts(lgProducts.slice(0, 12)) // Show up to 12 products

                    // Extract unique subcategories from LG products
                    // Note: In this app, 'description' field often holds the subcategory/type like "Refrigerator"
                    const lgSubCategories = new Set(lgProducts.map((p: any) =>
                        (p.subCategory || p.description || "").trim()
                    ))

                    // Filter our category list to only show what is available in DB
                    const validCategories = lgCategoryImages.filter(cat =>
                        Array.from(lgSubCategories).some(sub =>
                            sub && typeof sub === 'string' && sub.toLowerCase() === cat.title.toLowerCase()
                        )
                    )
                    setAvailableCategories(validCategories)
                }
            } catch (error) {
                console.error("Error fetching LG products:", error)
            } finally {
                setLoading(false)
            }
        }
        fetchProducts()
    }, [])

    const nextBanner = () => {
        setCurrentBanner((prev) => (prev + 1) % lgBannerImages.length)
    }

    const prevBanner = () => {
        setCurrentBanner((prev) => (prev - 1 + lgBannerImages.length) % lgBannerImages.length)
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
                    {lgBannerImages.map((banner, index) => (
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

                {/* LG Logo and Content */}
                <div className="absolute inset-0 z-20 flex items-center">
                    <div className="container mx-auto px-4 md:px-8">
                        <div
                            className={`max-w-2xl transition-all duration-1000 ${isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"
                                }`}
                        >


                            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
                                Life's Good
                            </h1>
                            <p className="text-lg md:text-xl text-white/90 mb-6 max-w-xl">
                                Experience innovation that makes life better. Discover LG's
                                cutting-edge technology in home appliances and entertainment.
                            </p>

                            <div className="flex flex-wrap gap-4">
                                <Link
                                    href="/products?brands=LG"
                                    className="group bg-gradient-to-r from-red-600 to-red-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-red-700 hover:to-red-600 transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                                >
                                    Shop LG Products
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
                        {lgBannerImages.map((_, index) => (
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
                            { icon: Sparkles, text: "Innovative Technology", color: "text-blue-400" },
                            { icon: Shield, text: "10 Year Warranty", color: "text-green-400" },
                            { icon: Zap, text: "Energy Efficient", color: "text-yellow-400" },
                            { icon: Award, text: "Award Winning Design", color: "text-purple-400" },
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
            {/* <section className="py-16 md:py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-2 bg-red-50 text-red-600 rounded-full text-sm font-semibold mb-4">
                            Explore Categories
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            LG Product Categories
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            From stunning OLED TVs to smart home appliances, discover the complete range
                            of LG products designed to enhance your lifestyle.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        {availableCategories.length > 0 ? (
                            availableCategories.map((category, index) => (
                                <Link
                                    href={`/products?brands=LG&subCategory=${encodeURIComponent(category.title)}`}
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

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                                        <h3 className="text-lg font-bold mb-1">{category.title}</h3>
                                        <p className="text-sm text-white/80">{category.description}</p>
                                        <div className="flex items-center mt-2 text-sm text-red-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
            </section> */}

            {/* Lifestyle Images Section */}
            <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Experience LG Lifestyle
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto mb-8">
                            See how LG products seamlessly integrate into your modern lifestyle
                        </p>
                        <button
                            onClick={() => setIsGalleryOpen(true)}
                            className="inline-flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full hover:bg-gray-800 transition-all hover:scale-105 shadow-md font-medium"
                        >
                            <Grid className="h-5 w-5" />
                            View Lifestyle Gallery
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {lgLifestyleImages.map((image, index) => (
                            <div
                                key={index}
                                className="relative rounded-3xl overflow-hidden shadow-lg group cursor-pointer"
                                onClick={() => setIsGalleryOpen(true)}
                            >
                                <img
                                    src={image.url}
                                    alt={image.alt}
                                    className="w-full h-80 md:h-[400px] object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <span className="bg-white/20 backdrop-blur-md text-white px-6 py-2 rounded-full border border-white/40 flex items-center gap-2 font-medium">
                                        <ZoomIn className="h-4 w-4" /> View Gallery
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Gallery Modal */}
            {isGalleryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                        onClick={() => setIsGalleryOpen(false)}
                    />
                    <div className="relative bg-white rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-2xl font-bold text-gray-900">LG Lifestyle Gallery</h3>
                            <button
                                onClick={() => setIsGalleryOpen(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-6 w-6 text-gray-500" />
                            </button>
                        </div>

                        {/* Gallery Grid */}
                        <div className="flex-1 overflow-y-auto p-6 bg-gray-50 custom-scrollbar">
                            <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
                                {lgLifestyleGalleryImages.map((src, index) => (
                                    <div
                                        key={index}
                                        className="break-inside-avoid relative rounded-xl overflow-hidden group shadow-sm hover:shadow-md transition-all cursor-zoom-in"
                                        onClick={() => setSelectedImage(src)}
                                    >
                                        <img
                                            src={src}
                                            alt={`LG Lifestyle ${index + 1}`}
                                            loading="lazy"
                                            className="w-full h-auto object-cover transform transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox for single image view inside gallery */}
            {selectedImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 animate-in fade-in duration-200"
                    onClick={() => setSelectedImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
                        onClick={() => setSelectedImage(null)}
                    >
                        <X className="h-8 w-8" />
                    </button>
                    <img
                        src={selectedImage}
                        alt="Full view"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl scale-in-95 animate-in duration-200"
                    />
                </div>
            )}

            {/* LG Products Section */}
            <section ref={productsRef} className="py-16 md:py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <span className="inline-block px-4 py-2 bg-red-50 text-red-600 rounded-full text-sm font-semibold mb-4">
                            Featured Products
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            Shop LG Products
                        </h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Discover our selection of LG products with cutting-edge technology
                            and award-winning design.
                        </p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <img src="/lg.png" alt="LG" className="h-6 w-6 object-contain" />
                                </div>
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
                                    href="/products?brands=LG"
                                    className="inline-flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 text-white px-8 py-4 rounded-xl font-semibold hover:from-red-700 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                                >
                                    View All LG Products
                                    <ArrowRight className="h-5 w-5" />
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-16">
                            <div className="mb-6">
                                <img
                                    src="/lg.png"
                                    alt="LG"
                                    className="h-16 mx-auto opacity-30"
                                />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                LG Products Coming Soon
                            </h3>
                            <p className="text-gray-500 mb-6">
                                We're adding LG products to our collection. Check back soon!
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
            <section className="py-12 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900">
                <div className="container mx-auto px-4">
                    <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-white">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                                <Star className="h-6 w-6 text-red-400" />
                            </div>
                            <div>
                                <div className="font-bold text-lg">4.8/5 Rating</div>
                                <div className="text-sm text-gray-400">Customer Reviews</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-green-600/20 flex items-center justify-center">
                                <Shield className="h-6 w-6 text-green-400" />
                            </div>
                            <div>
                                <div className="font-bold text-lg">10 Year Warranty</div>
                                <div className="text-sm text-gray-400">On Compressors</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center">
                                <Zap className="h-6 w-6 text-blue-400" />
                            </div>
                            <div>
                                <div className="font-bold text-lg">Energy Star</div>
                                <div className="text-sm text-gray-400">Certified Products</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    )
}
