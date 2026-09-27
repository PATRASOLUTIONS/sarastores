"use client"

import { Phone, MapPin, Clock, Percent, CreditCard, Gift, Zap, Star, ShieldCheck, Truck } from "lucide-react"
import Image from "next/image"
import { motion } from "framer-motion"
import {
    Handshake,
    Building2,
    Tv,
    Smartphone,
    Laptop,
    Home,
    Mail,
    ExternalLink,
    ChevronRight,
    Users,
    Award,
    TrendingUp,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    Send
} from "lucide-react"

/* ============================
   EDITABLE DATA — Change anything below
   ============================ */

const SALE_CONFIG = {
    title: "EPIC FULL MOON SALE",
    subtitle: "UNLOCK THE POWER OF THE FULL MOON",
    timing: { from: "9 AM", to: "12 MIDNIGHT", label: "ONLY" },
    acBanner: "BUY ANY AC & GET A FREE SAFARI TROLLEY BAG WORTH ₹9,999",
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

const PROMO_BADGES = [
    { icon: "0%", title: "PROCESSING FEE", subtitle: "ZERO INTEREST! HIDDEN COSTS" },
    { icon: "₹26K", title: "CASHBACK UP TO", subtitle: "On Credit & Debit Cards" },
    { icon: "EMI", title: "EMI CARD", subtitle: "CREDIT / DEBIT CARD EMI" },
    { icon: "24", title: "MONTHS", subtitle: "NO COST EMI" },
]

const PRODUCTS = [
    {
        name: "1.0 TON 3 STAR\nSPLIT AIR CONDITIONER",
        image: "/products/ac.png",
        discount: 49,
        emiPerDay: 77,
        offerPrice: "22,990",
        mrp: "44,990",
        offer: "Stabilizer & Standard Installation Worth ₹3,990",
        brand: "SHARP",
    },
    {
        name: "1.5 TON 3 STAR\nSPLIT AIR CONDITIONER",
        image: "/products/ac.png",
        discount: 54,
        emiPerDay: 84,
        offerPrice: "24,990",
        mrp: "54,990",
        offer: "TROLLEY BAG WORTH ₹9999 FOR ₹149",
        brand: "SHARP",
    },
    {
        name: '55" SMART 4K\nUHD LED TV',
        image: "/products/tv.png",
        discount: 65,
        emiPerDay: 93,
        offerPrice: "27,990",
        mrp: "79,990",
        offer: "AIWA AW-SS8120 Worth ₹13,990",
        brand: "TCL",
    },
    {
        name: "55 UHD SMART\nGOOGLE TV",
        image: "/products/tv.png",
        discount: 39,
        emiPerDay: 119,
        offerPrice: "42,990",
        mrp: "69,990",
        offer: null,
        brand: "Haier",
    },
    {
        name: "233 LITERS\nFROST FREE\nREFRIGERATOR",
        image: "/products/fridge.png",
        discount: 42,
        emiPerDay: 51,
        offerPrice: "18,499",
        mrp: "31,990",
        offer: "10% CASH BACK",
        brand: "Samsung",
    },
    {
        name: "563 LITERS\nSIDE BY SIDE",
        image: "/products/sidebyside.png",
        discount: 62,
        emiPerDay: 133,
        offerPrice: "39,900",
        mrp: "99,990",
        offer: null,
        brand: "Haier",
    },
    {
        name: "600 LITERS\nSIDE BY SIDE",
        image: "/products/sidebyside.png",
        discount: 62,
        emiPerDay: 170,
        offerPrice: "51,000",
        mrp: "1,25,990",
        offer: "MICROWAVE OVEN Worth ₹4,990",
        brand: "LG",
    },
    {
        name: "DISHWASHER",
        image: "/products/dishwasher.png",
        discount: 44,
        emiPerDay: 67,
        offerPrice: "19,990",
        mrp: "35,890",
        offer: "TROLLEY BAG WORTH ₹9999",
        brand: "Bosch",
    },
    {
        name: "SIEMENS 10 KG\nFRONT LOAD",
        image: "/products/washer.png",
        discount: 52,
        emiPerDay: 130,
        offerPrice: "39,000",
        mrp: "79,990",
        offer: "With ₹4000 CASH BACK",
        brand: "Siemens",
    },
    {
        name: "9 KG FRONT LOAD",
        image: "/products/washer.png",
        discount: 52,
        emiPerDay: 94,
        offerPrice: "28,000",
        mrp: "58,990",
        offer: "10% CASH BACK",
        brand: "Samsung",
    },
    {
        name: "iPhone 17\n(256GB)",
        image: "/products/iphone.png",
        discount: null,
        emiPerDay: 115,
        offerPrice: null,
        mrp: null,
        offer: "SAFARI TROLLEY BAG WORTH ₹9999 + ADOPTER ₹1899 + SCREEN GUARD",
        brand: "Apple",
    },
    {
        name: "SAMSUNG\nS26 ULTRA",
        image: "/products/samsung-phone.png",
        discount: null,
        emiPerDay: 194,
        offerPrice: null,
        mrp: null,
        offer: "₹19000 CASH BACK\nSAFARI TROLLEY BAG WORTH ₹9999",
        brand: "Samsung",
    },
    {
        name: "NOTE 15 PRO 5G\n(8GB+128GB)",
        image: "/products/redmi.png",
        discount: null,
        emiPerDay: 48,
        offerPrice: null,
        mrp: null,
        offer: "SAFARI TROLLEY BAG ₹9999",
        brand: "Redmi",
    },
]

const BRAND_LOGOS = [
    "LG", "SAMSUNG", "Haier", "SHARP", "BOSCH", "Godrej",
    "TCL", "Midea", "TOSHIBA", "vivo", "Xiaomi", "OPPO"
]

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

export default function EpicSalePage() {
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
        <img
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
                            EPIC
                        </span>
                    </h1>
                    <h2 className="text-3xl md:text-5xl lg:text-6xl font-black text-white mt-1 leading-none">
                        FULL MOON
                    </h2>
                    <h2 className="text-5xl md:text-7xl lg:text-8xl font-black leading-none text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 mt-1">
                        SALE
                    </h2>
                    <p className="text-xs text-amber-200/70 tracking-[0.3em] uppercase mt-2">
                        {SALE_CONFIG.subtitle}
                    </p>
                </div>

                {/* Timing Badge */}
                <div className="mt-6 inline-flex items-center gap-3 md:gap-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-3 rounded-full shadow-lg shadow-amber-500/30">
                    <Clock className="w-5 h-5" />
                    <span className="font-black text-lg md:text-xl">
                        {SALE_CONFIG.timing.from}
                    </span>
                    <span className="opacity-70 text-sm">to</span>
                    <span className="font-black text-lg md:text-xl">
                        {SALE_CONFIG.timing.to}
                    </span>
                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
                        {SALE_CONFIG.timing.label}
                    </span>
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
                    {SALE_CONFIG.acBanner}
                    <Gift className="w-5 h-5 inline ml-2 -mt-0.5" />
                </p>
            </div>

            {/* ===== PRODUCT GRID ===== */}
            <section className="max-w-7xl mx-auto px-3 md:px-4 py-8 md:py-12">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                    {PRODUCTS.map((product, i) => (
                        <ProductCard key={i} product={product} />
                    ))}
                </div>
            </section>

            {/* ===== BRAND LOGOS ===== */}
            <div className="bg-white py-4 px-4">
                <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 md:gap-8">
                    {BRAND_LOGOS.map((brand, i) => (
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
                            <h4 className="text-2xl md:text-3xl font-black text-white">{SALE_CONFIG.storeName}</h4>
                            <p className="text-blue-200 text-sm mt-1">{SALE_CONFIG.storeTagline}</p>
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
                    <p className="text-center text-[10px] text-blue-300/60 mt-6">* T&C apply. Offers valid till stocks last. Images are for representation purposes only.</p>
                </div>
            </footer>
        </div>
    )
}

/* ============================
   PRODUCT CARD COMPONENT
   ============================ */

function ProductCard({ product }: { product: typeof PRODUCTS[0] }) {
    return (
        <div className="group relative bg-white rounded-2xl overflow-hidden shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30 transition-all duration-300 hover:-translate-y-1">
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
                <img
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

                {/* EMI Badge */}
                <div className="mt-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-[10px] md:text-xs font-bold px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5">
                    <Zap className="w-3 h-3" />
                    EMI DAY <span className="text-amber-300 text-sm md:text-base font-black">₹{product.emiPerDay}</span>
                </div>

                {/* Prices */}
                {product.offerPrice && (
                    <div className="mt-2">
                        <div className="flex items-baseline gap-2">
                            <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-[10px] md:text-xs font-bold px-2 py-1 rounded-md">
                                Offer Price
                            </span>
                            <span className="text-green-700 font-black text-base md:text-lg">₹{product.offerPrice}</span>
                        </div>
                        {product.mrp && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-gray-400">MRP:</span>
                                <span className="text-xs text-gray-400 line-through">₹{product.mrp}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Free Offer */}
                {product.offer && (
                    <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                        <p className="text-[9px] md:text-[10px] font-bold text-amber-800 leading-tight">
                            <Gift className="w-3 h-3 inline mr-1 -mt-0.5 text-amber-600" />
                            {product.offer.split("\n").map((line, i) => (
                                <span key={i}>{line}{i < product.offer!.split("\n").length - 1 && <br />}</span>
                            ))}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
