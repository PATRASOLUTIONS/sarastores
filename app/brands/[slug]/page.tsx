"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CategoryProductCard from "@/components/CategoryProductCard"
import LeadForm from "@/components/LeadForm"
import Link from "next/link"
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Shield,
    Zap,
    Award,
    Star,
    Settings,
    Wrench,
    CheckCircle,
    Sparkles,
    Heart,
    Globe,
    ShoppingBag,
    MessageSquare,
    Loader2,
} from "lucide-react"
import { normalizeProductForSchema } from "@/lib/product-schema"

// Icon mapping for dynamic rendering
const ICON_MAP: Record<string, any> = {
    Shield,
    Zap,
    Award,
    Star,
    Settings,
    Wrench,
    CheckCircle,
    Sparkles,
    Heart,
    Globe,
    ShoppingBag,
    MessageSquare,
}

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

interface BrandData {
    _id: string
    name: string
    slug: string
    enabled: boolean
    logo: string
    tagline: string
    description: string
    accentColor: string
    accentColorFrom: string
    accentColorTo: string
    heroBgFrom: string
    heroBgTo: string
    trustBadgeBg: string
    banners: { url: string; alt: string; link?: string }[]
    categories: { url: string; title: string; description: string; link?: string }[]
    features: { icon: string; text: string; color: string }[]
    whyChoose: {
        title: string
        heading: string
        subtitle: string
        reasons: { icon: string; title: string; description: string }[]
    }
    productsSection: {
        badge: string
        badgeColor: string
        heading: string
        subtitle: string
        manufacturerFilter: string
        maxProducts: number
        ctaText: string
        ctaLink: string
    }
    categorySection: {
        badge: string
        badgeColor: string
        heading: string
        subtitle: string
    }
    trustBadges: {
        icon: string
        iconColor: string
        bgColor: string
        title: string
        subtitle: string
    }[]
    heroContent: {
        title: string
        titleStyle?: string
        subtitle: string
        description: string
        ctaText: string
        ctaLink: string
        ctaColor: string
        secondaryCta?: string
    }
    leadFormEnabled: boolean
    leadFormSource?: string
}

// Helper to get icon component by name
function IconComponent({ name, className }: { name: string; className?: string }) {
    const Icon = ICON_MAP[name]
    if (!Icon) return <Star className={className} />
    return <Icon className={className} />
}

/**
 * Brands added through the simple catalogue form only carry a name and slug,
 * so the rich landing template has to be given empty structures to render.
 */
function withBrandDefaults(b: any): BrandData {
    const name = b?.name || "Brand"
    const shopLink = `/products?brand=${encodeURIComponent(name)}`

    return {
        ...b,
        name,
        tagline: b?.tagline || "",
        description: b?.description || "",
        banners: Array.isArray(b?.banners) ? b.banners : [],
        categories: Array.isArray(b?.categories) ? b.categories : [],
        features: Array.isArray(b?.features) ? b.features : [],
        trustBadges: Array.isArray(b?.trustBadges) ? b.trustBadges : [],
        heroContent: {
            title: name.toUpperCase(),
            subtitle: b?.tagline || "",
            description: b?.description || `Shop genuine ${name} products at SARA.`,
            ctaText: `Shop ${name} Products`,
            ctaLink: shopLink,
            ctaColor: "from-[#1560BD] to-[#0F2557]",
            secondaryCta: "",
            ...(b?.heroContent || {}),
        },
        productsSection: {
            badge: "Featured Products",
            badgeColor: "bg-blue-50 text-blue-600",
            heading: `Shop ${name} Products`,
            subtitle: "",
            manufacturerFilter: String(name).toLowerCase(),
            maxProducts: 12,
            ctaText: `View All ${name} Products`,
            ctaLink: shopLink,
            ...(b?.productsSection || {}),
        },
        categorySection: {
            badge: "Explore Categories",
            badgeColor: "bg-blue-50 text-blue-600",
            heading: `${name} Product Categories`,
            subtitle: "",
            ...(b?.categorySection || {}),
        },
        whyChoose: {
            title: `Why Choose ${name}`,
            heading: `Why Choose ${name}?`,
            subtitle: "",
            reasons: [],
            ...(b?.whyChoose || {}),
        },
        leadFormEnabled: b?.leadFormEnabled === true,
    } as BrandData
}

export default function DynamicBrandPage() {
    const params = useParams()
    const slug = params.slug as string

    const [brand, setBrand] = useState<BrandData | null>(null)
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [productsLoading, setProductsLoading] = useState(true)
    const [currentBanner, setCurrentBanner] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [availableCategories, setAvailableCategories] = useState<BrandData["categories"]>([])
    const [notFound, setNotFound] = useState(false)

    const heroRef = useRef<HTMLDivElement>(null)
    const productsRef = useRef<HTMLDivElement>(null)

    // Fetch brand data
    useEffect(() => {
        const fetchBrand = async () => {
            try {
                const res = await fetch(`/api/brands?slug=${slug}`)
                const data = await res.json()
                if (data.success && data.brand) {
                    // Older records use `enabled`, newer ones `isEnabled`/`active`.
                    // Treat a brand as live unless one of them is explicitly false.
                    const b = data.brand
                    const disabled =
                        b.enabled === false ||
                        b.isEnabled === false ||
                        b.active === false ||
                        b.landingPageEnabled === false
                    if (disabled) {
                        setNotFound(true)
                    } else {
                        setBrand(withBrandDefaults(b))
                    }
                } else {
                    setNotFound(true)
                }
            } catch (error) {
                console.error("Error fetching brand:", error)
                setNotFound(true)
            } finally {
                setLoading(false)
            }
        }
        if (slug) fetchBrand()
    }, [slug])

    // Auto-rotate banner
    useEffect(() => {
        if (!brand || brand.banners.length === 0) return
        const interval = setInterval(() => {
            setCurrentBanner((prev) => (prev + 1) % brand.banners.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [brand])

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
    }, [brand])

    // Fetch products filtered by manufacturer
    useEffect(() => {
        if (!brand) return
        const fetchProducts = async () => {
            try {
                const response = await fetch("/api/products")
                if (response.ok) {
                    const data = await response.json()
                    const filterStr = brand.productsSection?.manufacturerFilter || brand.name
                    const brandProducts = data.filter((p: any) => {
                        const manufacturer = normalizeProductForSchema(p).manufacturerName || p.manufacturer || ""
                        return manufacturer.toLowerCase().includes(filterStr.toLowerCase())
                    })
                    const maxProducts = brand.productsSection?.maxProducts || 12
                    setProducts(brandProducts.slice(0, maxProducts))

                    // Filter categories based on available products
                    if (brand.categories && brand.categories.length > 0) {
                        const productSubCategories = new Set(
                            brandProducts.map((p: any) =>
                                (p.subCategory || p.description || "").trim()
                            )
                        )
                        const validCategories = brand.categories.filter((cat) =>
                            Array.from(productSubCategories).some(
                                (sub) =>
                                    sub &&
                                    typeof sub === "string" &&
                                    sub.toLowerCase() === cat.title.toLowerCase()
                            )
                        )
                        setAvailableCategories(
                            validCategories.length > 0 ? validCategories : brand.categories
                        )
                    }
                }
            } catch (error) {
                console.error("Error fetching products:", error)
            } finally {
                setProductsLoading(false)
            }
        }
        fetchProducts()
    }, [brand])

    const nextBanner = () => {
        if (!brand) return
        setCurrentBanner((prev) => (prev + 1) % brand.banners.length)
    }

    const prevBanner = () => {
        if (!brand) return
        setCurrentBanner((prev) => (prev - 1 + brand.banners.length) % brand.banners.length)
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-white">
                <Header />
                <div className="flex items-center justify-center h-[60vh]">
                    <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-gray-500">Loading brand page...</p>
                    </div>
                </div>
                <Footer />
            </div>
        )
    }

    // Not found state
    if (notFound || !brand) {
        return (
            <div className="min-h-screen bg-white">
                <Header />
                <div className="flex items-center justify-center h-[60vh]">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold text-gray-900 mb-4">Brand Not Found</h1>
                        <p className="text-gray-500 mb-8">
                            The brand page you&apos;re looking for doesn&apos;t exist or has been disabled.
                        </p>
                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-all"
                        >
                            Browse All Products
                            <ArrowRight className="h-5 w-5" />
                        </Link>
                    </div>
                </div>
                <Footer />
            </div>
        )
    }

    const heroContent = brand.heroContent || {
        title: brand.name.toUpperCase(),
        subtitle: brand.tagline || "",
        description: brand.description || "",
        ctaText: `Shop ${brand.name} Products`,
        ctaLink: `/products?brands=${encodeURIComponent(brand.name)}`,
        ctaColor: "from-blue-600 to-blue-500",
        secondaryCta: "Learn More",
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <Header />

            {/* Brand JSON-LD for AI/crawlers */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Brand",
                        name: brand.name,
                        url: `https://bytewise.shop/brands/${brand.slug}`,
                        ...(brand.logo && { logo: brand.logo }),
                        ...(brand.description && { description: brand.description }),
                    }),
                }}
            />
            {brand.description && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            "@context": "https://schema.org",
                            "@type": "BreadcrumbList",
                            itemListElement: [
                                { "@type": "ListItem", position: 1, name: "Home", item: "https://bytewise.shop" },
                                { "@type": "ListItem", position: 2, name: "Brands", item: "https://bytewise.shop/brands" },
                                { "@type": "ListItem", position: 3, name: brand.name },
                            ],
                        }),
                    }}
                />
            )}

            {/* Hero fallback: brands added through the simple form have no banner art. */}
            {brand.banners.length === 0 && (
                <section className="bg-gradient-to-br from-[#0F2557] via-[#12509E] to-[#1560BD] text-white">
                    <div className="section-container py-14 md:py-20">
                        {brand.logo ? (
                            <>
                                {/* A white chip keeps dark brand marks legible on the navy hero. */}
                                <span className="inline-flex h-[72px] items-center justify-center rounded-xl bg-white px-6 shadow-sm">
                                    <img
                                        src={brand.logo}
                                        alt={`${brand.name} logo`}
                                        className="max-h-11 w-auto max-w-[220px] object-contain"
                                    />
                                </span>
                                <h1 className="sr-only">{brand.heroContent.title}</h1>
                            </>
                        ) : (
                            <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
                                {brand.heroContent.title}
                            </h1>
                        )}
                        {brand.heroContent.subtitle && (
                            <p className="mt-4 text-lg text-white/80">{brand.heroContent.subtitle}</p>
                        )}
                        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
                            {brand.heroContent.description}
                        </p>
                        <Link
                            href={brand.heroContent.ctaLink}
                            className="mt-7 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[#0F2557] transition-transform hover:scale-[1.02]"
                        >
                            {brand.heroContent.ctaText}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </section>
            )}

            {/* Hero Banner Section */}
            {brand.banners.length > 0 && (
                <section ref={heroRef} className="relative h-[60vh] md:h-[70vh] overflow-hidden">
                    {/* Background gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent z-10" />

                    {/* Banner Images */}
                    <div className="relative h-full">
                        {brand.banners.map((banner, index) => (
                            <div
                                key={index}
                                className={`absolute inset-0 transition-all duration-1000 ${
                                    index === currentBanner
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

                    {/* Hero Content */}
                    <div className="absolute inset-0 z-20 flex items-center">
                        <div className="container mx-auto px-4 md:px-8">
                            <div
                                className={`max-w-2xl transition-all duration-1000 ${
                                    isVisible
                                        ? "opacity-100 translate-x-0"
                                        : "opacity-0 -translate-x-10"
                                }`}
                            >
                                {/* Brand Logo / Title */}
                                <div className="mb-8">
                                    {brand.logo ? (
                                        <>
                                            <span className="mb-4 inline-flex h-[72px] items-center justify-center rounded-xl bg-white px-6 shadow-sm">
                                                <img
                                                    src={brand.logo}
                                                    alt={`${brand.name} logo`}
                                                    className="max-h-11 w-auto max-w-[220px] object-contain"
                                                />
                                            </span>
                                            <h1 className="sr-only">{heroContent.title}</h1>
                                        </>
                                    ) : (
                                        <h1
                                            className="text-5xl md:text-7xl font-bold text-white mb-2"
                                            style={{
                                                fontFamily: "Arial, sans-serif",
                                                letterSpacing: "0.05em",
                                            }}
                                        >
                                            {heroContent.title}
                                        </h1>
                                    )}
                                    {heroContent.subtitle && (
                                        <p className="text-xl md:text-2xl text-blue-200 font-light italic">
                                            {heroContent.subtitle}
                                        </p>
                                    )}
                                </div>

                                {heroContent.description && (
                                    <p className="text-lg md:text-xl text-white/90 mb-6 max-w-xl">
                                        {heroContent.description}
                                    </p>
                                )}

                                <div className="flex flex-wrap gap-4">
                                    <Link
                                        href={heroContent.ctaLink}
                                        className={`group bg-gradient-to-r ${heroContent.ctaColor} text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1`}
                                    >
                                        {heroContent.ctaText}
                                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                    </Link>
                                    {heroContent.secondaryCta && (
                                        <button className="bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-xl font-semibold border border-white/30 hover:bg-white/20 transition-all duration-300">
                                            {heroContent.secondaryCta}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Banner Navigation */}
                    {brand.banners.length > 1 && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4">
                            <button
                                onClick={prevBanner}
                                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>

                            <div className="flex items-center">
                                {brand.banners.map((_, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => setCurrentBanner(index)}
                                        aria-label={`Go to banner ${index + 1}`}
                                        aria-current={index === currentBanner}
                                        className="group flex h-6 min-w-[24px] items-center justify-center"
                                    >
                                        <span
                                            className={`h-2 rounded-full transition-all duration-300 ${
                                                index === currentBanner
                                                    ? "w-8 bg-white"
                                                    : "w-2 bg-white/50 group-hover:bg-white/70"
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={nextBanner}
                                className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center hover:bg-white/30 transition-all"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    )}
                </section>
            )}

            {/* Brand Features Strip */}
            {brand.features.length > 0 && (
                <section className="py-8 bg-gradient-to-r from-gray-900 to-gray-800">
                    <div className="container mx-auto px-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {brand.features.map((feature, index) => (
                                <div
                                    key={index}
                                    className="flex items-center justify-center gap-3 py-4 text-white"
                                >
                                    <IconComponent
                                        name={feature.icon}
                                        className={`h-6 w-6 ${feature.color}`}
                                    />
                                    <span className="text-sm md:text-base font-medium">
                                        {feature.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Category Gallery Section */}
            {(availableCategories.length > 0 || brand.categories.length > 0) && (
                <section className="py-16 md:py-20 bg-white">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            {brand.categorySection?.badge && (
                                <span
                                    className={`inline-block px-4 py-2 ${
                                        brand.categorySection.badgeColor || "bg-blue-50 text-blue-600"
                                    } rounded-full text-sm font-semibold mb-4`}
                                >
                                    {brand.categorySection.badge}
                                </span>
                            )}
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                                {brand.categorySection?.heading ||
                                    `${brand.name} Product Categories`}
                            </h2>
                            {brand.categorySection?.subtitle && (
                                <p className="text-gray-600 max-w-2xl mx-auto">
                                    {brand.categorySection.subtitle}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            {(availableCategories.length > 0
                                ? availableCategories
                                : brand.categories
                            ).map((category, index) => (
                                <Link
                                    href={
                                        category.link ||
                                        `/products?brands=${encodeURIComponent(brand.name)}&subCategory=${encodeURIComponent(category.title)}`
                                    }
                                    key={index}
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
                                        <h3 className="text-lg font-bold mb-1">
                                            {category.title}
                                        </h3>
                                        <p className="text-sm text-white/80">
                                            {category.description}
                                        </p>
                                        <div className="flex items-center mt-2 text-sm text-blue-300 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            Shop Now <ArrowRight className="ml-1 h-4 w-4" />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Why Choose Section */}
            {brand.whyChoose?.reasons && brand.whyChoose.reasons.length > 0 && (
                <section className="py-16 bg-gradient-to-b from-gray-50 to-white">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                                {brand.whyChoose.heading || `Why Choose ${brand.name}?`}
                            </h2>
                            {brand.whyChoose.subtitle && (
                                <p className="text-gray-600 max-w-2xl mx-auto">
                                    {brand.whyChoose.subtitle}
                                </p>
                            )}
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {brand.whyChoose.reasons.map((reason, index) => (
                                <div
                                    key={index}
                                    className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100"
                                >
                                    <div
                                        className={`w-16 h-16 bg-gradient-to-br ${
                                            heroContent.ctaColor || "from-blue-600 to-blue-500"
                                        } rounded-xl flex items-center justify-center mb-6`}
                                    >
                                        <IconComponent
                                            name={reason.icon}
                                            className="w-8 h-8 text-white"
                                        />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                                        {reason.title}
                                    </h3>
                                    <p className="text-gray-600">{reason.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Lead Form Section */}
            {brand.leadFormEnabled && (
                <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800">
                    <div className="container mx-auto px-4">
                        <div className="max-w-2xl mx-auto">
                            <div className="text-center mb-8">
                                <h2 className="text-3xl font-bold text-white mb-3">
                                    Interested in {brand.name} Products?
                                </h2>
                                <p className="text-gray-300">
                                    Fill out the form below and our team will get back to you with the best deals.
                                </p>
                            </div>
                            <LeadForm
                                source={brand.leadFormSource || `${brand.name} Brand Page`}
                                variant="dark"
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* Products Section */}
            <section ref={productsRef} className="py-16 md:py-20 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        {brand.productsSection?.badge && (
                            <span
                                className={`inline-block px-4 py-2 ${
                                    brand.productsSection.badgeColor || "bg-red-50 text-red-600"
                                } rounded-full text-sm font-semibold mb-4`}
                            >
                                {brand.productsSection.badge}
                            </span>
                        )}
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                            {brand.productsSection?.heading || `Shop ${brand.name} Products`}
                        </h2>
                        {brand.productsSection?.subtitle && (
                            <p className="text-gray-600 max-w-2xl mx-auto">
                                {brand.productsSection.subtitle}
                            </p>
                        )}
                    </div>

                    {productsLoading ? (
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

                            {brand.productsSection?.ctaLink && (
                                <div className="text-center mt-12">
                                    <Link
                                        href={brand.productsSection.ctaLink}
                                        className={`inline-flex items-center gap-2 bg-gradient-to-r ${
                                            heroContent.ctaColor || "from-blue-600 to-blue-500"
                                        } text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1`}
                                    >
                                        {brand.productsSection.ctaText ||
                                            `View All ${brand.name} Products`}
                                        <ArrowRight className="h-5 w-5" />
                                    </Link>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-16">
                            <div className="mb-6">
                                <Settings className="h-16 w-16 mx-auto text-gray-300" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                {brand.name} Products Coming Soon
                            </h3>
                            <p className="text-gray-500 mb-6">
                                We&apos;re adding {brand.name} products to our collection. Check
                                back soon!
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
            {brand.trustBadges.length > 0 && (
                <section
                    className={`py-12 bg-gradient-to-r ${
                        brand.trustBadgeBg || "from-blue-900 via-blue-800 to-blue-900"
                    }`}
                >
                    <div className="container mx-auto px-4">
                        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-white">
                            {brand.trustBadges.map((badge, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <div
                                        className={`w-12 h-12 rounded-full ${
                                            badge.bgColor || "bg-blue-600/20"
                                        } flex items-center justify-center`}
                                    >
                                        <IconComponent
                                            name={badge.icon}
                                            className={`h-6 w-6 ${
                                                badge.iconColor || "text-blue-300"
                                            }`}
                                        />
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg">{badge.title}</div>
                                        <div className="text-sm text-blue-200">
                                            {badge.subtitle}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <Footer />
        </div>
    )
}
