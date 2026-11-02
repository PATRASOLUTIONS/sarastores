import SiteImage from "@/components/SiteImage"
import Link from "next/link"
import { MapPin, Clock, Gift, Handshake } from "lucide-react"
import { getPublicPageProducts } from "@/lib/public-page-data"
import { catalogueBrand } from "@/lib/product-metadata-sheet"

export const dynamic = "force-dynamic"

/* ============================
   EDITABLE DATA — Change anything below
   ============================ */

const SALE_CONFIG = {
    title: "Epic Electronics & Appliance Picks",
    subtitle: "EXPLORE CURRENT PRODUCT PRICES AND AVAILABILITY",
    availability: "CHECK CURRENT STOCK AND OFFER TERMS",
    acBanner: "See current offers and product-specific eligibility",
    shubhamStore: {
        name: "SHUBHAM",
        tagline: "The Electronic Shopee",
        subTagline: "Auspicious beginnings. Lasting relationships."
    },
    saraStore: {
        name: "SARA MOBILES",
        tagline: "Your Trusted Mobile Partner"
    }
}

type SaleProduct = {
    id: string
    slug?: string
    name: string
    image: string
    brand: string
    discount: number
    offerPrice: string
    mrp: string | null
}

const STORE_LOCATIONS = [
    { area: "DEVARAJA URS ROAD", phone: "9620203966" },
    { area: "NR MOHALLA", phone: "9620204600" },
    { area: "SHARDA DEVI NAGAR", phone: "9513551628" },
    { area: "JP NAGAR", phone: "9174753631" },
    { area: "KUVEMPU NAGAR", phone: "9164753609" },
]

/* ============================
   PAGE COMPONENT
   ============================ */

export default async function EpicSalePage() {
    const catalogue = await getPublicPageProducts()
    const products: SaleProduct[] = catalogue.filter(product => product.price > 0 && product.stock > 0)
        .map(product => {
            const mrp = Number(product.mrp) > product.price ? Number(product.mrp) : null
            return { id: product.id, slug: product.slug, name: product.name, image: product.image || "/placeholder.svg",
                brand: catalogueBrand(product), discount: mrp ? Math.floor((1 - product.price / mrp) * 100) : 0,
                offerPrice: product.price.toLocaleString("en-IN"), mrp: mrp ? mrp.toLocaleString("en-IN") : null }
        }).sort((left, right) => right.discount - left.discount).slice(0, 15)
    const brands = [...new Set(products.map(product => product.brand).filter(Boolean))]
    return (
        <div className="min-h-screen bg-[#0a1628] text-white overflow-x-hidden">
            
          

            <header className="relative overflow-hidden">
    {/* Background */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f2040] to-[#1a1040]" />

    {/* Moon Glow */}
    <div className="absolute top-10 left-10 md:left-20 w-40 h-40 md:w-64 md:h-64 rounded-full bg-gradient-to-br from-yellow-100 via-yellow-200 to-yellow-300 opacity-90 blur-sm" />
    <div className="absolute top-12 left-12 md:left-24 w-36 h-36 md:w-56 md:h-56 rounded-full bg-gradient-to-br from-gray-200 via-yellow-50 to-gray-300" />

    {/* Optional Hero Image */}
    <div className="absolute right-0 bottom-0 w-[200px] h-[200px] md:w-[350px] md:h-[350px] opacity-80 pointer-events-none hidden md:block">
        <SiteImage loading="eager"
            src="/epic-sale-hero.png"
            alt="Shopping"
            className="w-full h-full object-contain object-bottom"
        />
    </div>

    <div className="relative z-10 max-w-7xl mx-auto px-4 py-10 md:py-16">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">

            {/* ================= LEFT: SALE ================= */}
            <div className="flex-1 text-center lg:text-left">
                <div className="inline-block border-2 border-amber-400/60 rounded-xl px-6 py-4 md:px-10 md:py-6 backdrop-blur-sm bg-black/20">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-none">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">
                            {SALE_CONFIG.title}
                        </span>
                    </h1>
                    <p className="text-xs text-amber-200/70 tracking-[0.3em] uppercase mt-2">
                        {SALE_CONFIG.subtitle}
                    </p>
                </div>

                {/* Timing Badge */}
                <div className="mt-6 inline-flex items-center gap-3 md:gap-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-3 rounded-full shadow-lg shadow-amber-500/30">
                    <Clock className="w-5 h-5" />
                    <Link href="/products" className="font-bold text-sm md:text-base">
                        {SALE_CONFIG.availability}
                    </Link>
                </div>
            </div>

            {/* ================= RIGHT: PARTNERSHIP ================= */}
            <div className="flex-1 flex flex-col items-center lg:items-end text-center lg:text-right">

                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-5 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-6">
                    <Handshake className="w-5 h-5 text-yellow-400" />
                    <span className="text-white font-medium">
                        Strategic Partnership
                    </span>
                </div>

                {/* Logos */}
                <div className="flex items-center gap-6 mb-6">

                    {/* Sara Mobiles */}
                    <div className="w-24 h-24 md:w-28 md:h-28 bg-white rounded-xl shadow-xl flex items-center justify-center">
                        <div className="text-center">
                            <span className="text-lg font-bold text-blue-600">Sara</span>
                            <span className="text-lg font-bold text-gray-800"> Mobiles</span>
                        </div>
                    </div>

                    {/* Handshake */}
                    <div className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg">
                        <Handshake className="w-5 h-5 text-white" />
                    </div>

                    {/* Shubham */}
                    <div className="w-24 h-24 md:w-28 md:h-28 bg-white rounded-xl shadow-xl flex items-center justify-center">
                        <div className="text-center">
                            <span className="text-lg font-bold text-red-600">SHUBHAM</span>
                            <p className="text-[10px] text-gray-500">
                                The Electronic Shopee
                            </p>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white">
                    Stronger{" "}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-red-400">
                        Together
                    </span>
                </h2>

                {/* Subtitle */}
                <p className="text-white/60 text-sm mt-3 max-w-sm">
                    Two trusted names in electronics retail, united to bring you the best products, pricing, and service.
                </p>
            </div>
        </div>
    </div>
</header>

            {/* ===== AC OFFER BANNER ===== */}
            <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 py-3 px-4">
                <p className="text-center font-black text-base md:text-xl tracking-wide text-white">
                    <Gift className="w-5 h-5 inline mr-2 -mt-0.5" />
                    <Link href="/offers" className="underline underline-offset-4">{SALE_CONFIG.acBanner}</Link>
                    <Gift className="w-5 h-5 inline ml-2 -mt-0.5" />
                </p>
            </div>

            {/* ===== PRODUCT GRID ===== */}
            <section className="max-w-7xl mx-auto px-3 md:px-4 py-8 md:py-12">
                <h2 className="mb-4 text-xl font-bold">Current catalogue picks</h2>
                {products.length === 0 && <p className="mb-4">No available products are listed here right now. <Link href="/products" className="underline">Browse the catalogue</Link> or contact a store.</p>}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            </section>

            {/* ===== BRAND LOGOS ===== */}
            <div className="bg-white py-4 px-4">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8">
                    {brands.map((brand, i) => (
                        <span key={i} className="text-gray-800 font-black text-sm md:text-lg tracking-wider opacity-70 hover:opacity-100 transition-opacity">
                            {brand}
                        </span>
                    ))}
                </div>
            </div>

            {/* ===== FOOTER ===== */}
            <footer className="bg-gradient-to-r from-[#003087] to-[#0050d0] py-6 px-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="text-center md:text-left">
                            <h4 className="text-2xl md:text-3xl font-black text-white">{SALE_CONFIG.saraStore.name}</h4>
                            <p className="text-blue-200 text-sm mt-1">{SALE_CONFIG.saraStore.tagline}</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 md:gap-6 text-sm">
                            {STORE_LOCATIONS.map((loc, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-blue-100 hover:text-white transition-colors">
                                    <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                                    <span className="font-medium">{loc.area}</span>
                                    <span className="text-blue-300">–</span>
                                    <a href={`tel:${loc.phone}`} className="font-bold text-white hover:text-amber-300 transition-colors">
                                        {loc.phone}
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="text-center text-xs text-blue-100 mt-6">
                        Product prices and stock can change. Review applicable <Link href="/offers" className="underline">offer terms</Link>,{" "}
                        <Link href="/emi" className="underline">payment options</Link>,{" "}
                        <Link href="/shipping-policy" className="underline">shipping policy</Link> and{" "}
                        <Link href="/installation" className="underline">installation information</Link> before ordering.
                    </p>
                </div>
            </footer>
        </div>
    )
}

/* ============================
   PRODUCT CARD COMPONENT
   ============================ */

function ProductCard({ product }: { product: SaleProduct }) {
    return (
        <Link href={`/product/${encodeURIComponent(product.slug || product.id)}`} className="group relative block bg-white rounded-2xl overflow-hidden shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 hover:-translate-y-1">
            {/* Discount Badge */}
            {product.discount && (
                <div className="absolute top-2 right-2 z-10">
                    <div className="bg-gradient-to-br from-red-500 to-red-600 text-white text-xs md:text-sm font-black w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg shadow-red-500/40 ring-2 ring-white/30">
                        {product.discount}%
                    </div>
                </div>
            )}

            {/* Brand Tag */}
            <div className="absolute top-2 left-2 z-10">
                <span className="bg-black/70 backdrop-blur-sm text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {product.brand}
                </span>
            </div>

            {/* Image */}
            <div className="bg-gradient-to-b from-gray-50 to-white p-4 pt-8 pb-3 flex items-center justify-center h-36 md:h-44">
                <SiteImage
                    src={product.image}
                    alt={product.name.replace(/\n/g, " ")}
                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                />
            </div>

            {/* Product Info */}
            <div className="px-3 pb-3 pt-2 bg-white">
                {/* Name */}
                <h3 className="text-[10px] md:text-xs font-bold text-gray-900 leading-tight min-h-[28px] md:min-h-[32px] line-clamp-2">
                    {product.name.replace(/\n/g, " ")}
                </h3>

                {/* Prices */}
                {product.offerPrice && (
                    <div className="mt-2">
                        <div className="flex items-baseline gap-2">
                            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-md">
                                Current Price
                            </span>
                            <span className="text-green-700 font-black text-base md:text-lg">₹{product.offerPrice}</span>
                        </div>
                        {product.mrp && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-600">MRP:</span>
                                <span className="text-xs text-gray-600 line-through">₹{product.mrp}</span>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </Link>
    )
}
