"use client"

import { useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
    Gift,
    Trophy,
    Star,
    Sparkles,
    Phone,
    Tv,
    Laptop,
    Headphones,
    Watch,
    Smartphone,
    CheckCircle2,
    AlertCircle,
    Calendar,
    Clock,
    Users,
    FileText,
    ChevronDown,
    ChevronUp,
    Send,
    PartyPopper,
    Zap,
    Shield,
    Crown,
    Ticket,
    Award,
    MapPin,
    MessageSquare
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import LeadForm from "@/components/LeadForm"

// Campaign Information
const campaignInfo = {
    title: "Shubham Lucky Draw (₹1,00,000)",
    tagline: "Participate & Win Big Prizes!",
    period: {
        start: "January 15, 2026",
        end: "February 28, 2026"
    },
    smsNumber: "7892051553",
    smsFormat: "<First Name> <Last Name> <Invoice Number>",
    totalPrizeValue: "₹1,00,000"
}

// Prize Categories
const grandPrizes = [
    {
        title: "Dream Home Package",
        value: "₹5,00,000",
        items: ["65\" Smart OLED TV", "Side-by-Side Refrigerator", "Washing Machine", "Split AC", "Microwave Oven"],
        icon: Trophy,
        color: "from-yellow-400 via-amber-500 to-orange-500",
        bgGlow: "bg-yellow-500/20"
    },
    {
        title: "Tech Bundle",
        value: "₹2,50,000",
        items: ["Gaming Laptop", "5G Smartphone", "Smart Watch", "Wireless Earbuds", "Smart Speaker"],
        icon: Laptop,
        color: "from-blue-400 via-blue-500 to-indigo-600",
        bgGlow: "bg-blue-500/20"
    },
    {
        title: "Entertainment Package",
        value: "₹1,50,000",
        items: ["55\" 4K Smart TV", "Soundbar System", "Gaming Console", "Home Theater"],
        icon: Tv,
        color: "from-purple-400 via-purple-500 to-pink-500",
        bgGlow: "bg-purple-500/20"
    }
]

const dailyPrizes = [
    { name: "Smartphone", icon: Smartphone, quantity: "1 Daily" },
    { name: "Smart Watch", icon: Watch, quantity: "2 Daily" },
    { name: "Wireless Earbuds", icon: Headphones, quantity: "5 Daily" },
    { name: "Power Bank", icon: Zap, quantity: "10 Daily" }
]

const assuredGifts = [
    { minPurchase: "₹5,000", gift: "Premium Screen Guard + Cleaning Kit" },
    { minPurchase: "₹10,000", gift: "Wireless Earbuds worth ₹1,999" },
    { minPurchase: "₹25,000", gift: "Smart Watch worth ₹4,999" },
    { minPurchase: "₹50,000", gift: "Bluetooth Speaker worth ₹6,999" },
    { minPurchase: "₹1,00,000", gift: "Free Extended Warranty (2 Years)" }
]

// Steps to Participate
const participationSteps = [
    {
        step: 1,
        title: "Shop at Sara Mobiles",
        description: "Purchase any electronics worth ₹5,000 or more from any Sara Mobiles store or online",
        icon: Gift
    },
    {
        step: 2,
        title: "Save Your Invoice",
        description: "Keep your purchase invoice safe - you'll need the invoice number for registration",
        icon: FileText
    },
    {
        step: 3,
        title: "Send SMS",
        description: `SMS your details to ${campaignInfo.smsNumber} in the format: ${campaignInfo.smsFormat}`,
        icon: MessageSquare
    },
    {
        step: 4,
        title: "Get Confirmation",
        description: "Receive a unique registration code via SMS confirming your entry",
        icon: CheckCircle2
    },
    {
        step: 5,
        title: "Win Prizes!",
        description: "Winners are selected daily and will be contacted by Sara Mobiles team",
        icon: Trophy
    }
]

// Terms & Conditions
const termsCategories = [
    {
        title: "Eligibility",
        items: [
            "This offer is valid for all customers purchasing electronics products from Sara Mobiles & Electronics stores or official website during the offer period.",
            "Participants must be 18 years of age or above and citizens of India.",
            "Employees of Sara Mobiles & Electronics and their immediate family members are not eligible to participate.",
            "The offer is valid across all Sara Mobiles stores in Karnataka and Andhra Pradesh.",
            "One mobile number can be registered only once. For multiple purchases, use different mobile numbers."
        ]
    },
    {
        title: "Registration Process",
        items: [
            'Fill the lucky draw coupon in-store and wait for the month-end announcement to win exciting prizes'
        ]
    },
    {
        title: "Prize Details",
        items: [
            "Grand prizes will be drawn weekly. Daily prizes will be drawn every day during the offer period.",
            "Winners must collect their prizes from the specified Sara Mobiles store location.",
            "Valid government ID (Aadhaar/PAN) and original purchase invoice must be presented to claim prizes.",
            "Prizes cannot be exchanged for cash or other products.",
            "All applicable taxes (including gift tax) are to be borne by the winner."
        ]
    },
    {
        title: "General Terms",
        items: [
            "Sara Mobiles reserves the right to modify, extend, or terminate this offer without prior notice.",
            "The decision of Sara Mobiles regarding winner selection is final and binding.",
            "By participating, customers agree to be contacted for marketing and promotional activities.",
            "Sara Mobiles is not responsible for any loss or damage during prize collection or usage.",
            "Participants agree to allow their names and photos to be used for promotional purposes."
        ]
    }
]

// FAQ
const faqs = [
    {
        question: "How do I participate in the Lucky Draw?",
        answer: "Simply purchase any electronics worth ₹5,000 or more from Sara Mobiles, then send an SMS with your name and invoice number to our registration number. You'll receive a confirmation with your entry code."
    },
    {
        question: "When will the winners be announced?",
        answer: "Daily prize winners are announced every evening at 6 PM on our official website and social media. Grand prize winners are announced every Sunday."
    },
    {
        question: "Can I participate multiple times?",
        answer: "Yes! Each purchase of ₹5,000 or more qualifies for one entry. Use a different mobile number for each registration."
    },
    {
        question: "How will I know if I've won?",
        answer: "Winners will be contacted directly via the registered mobile number. We also publish winner lists on our website and social media pages."
    },
    {
        question: "What documents do I need to claim my prize?",
        answer: "You'll need: (1) Original purchase invoice, (2) Valid government ID (Aadhaar/PAN), (3) The mobile phone used for registration."
    },
    {
        question: "Are online purchases eligible?",
        answer: "Yes, purchases made through our official website www.saramobiles.com are eligible for the lucky draw."
    }
]

export default function LuckyDrawPage() {
    const [activeTab, setActiveTab] = useState("register")
    const [expandedFaq, setExpandedFaq] = useState<number | null>(0)
    const [expandedTerms, setExpandedTerms] = useState<number | null>(0)

    const tabs = [
        { id: "register", label: "Register Now", icon: Send },
        // { id: "prizes", label: "Prizes", icon: Gift },
        { id: "participate", label: "How to Participate", icon: Ticket },
        { id: "terms", label: "Terms & Conditions", icon: FileText },
        { id: "faq", label: "FAQ", icon: MessageSquare }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
            <Header />

            {/* Hero Section */}
            <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden pt-20">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-yellow-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl"></div>

                    {/* Floating particles */}
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `${Math.random() * 100}%`,
                            }}
                            animate={{
                                y: [0, -30, 0],
                                opacity: [0.2, 1, 0.2],
                            }}
                            transition={{
                                duration: 3 + Math.random() * 2,
                                repeat: Infinity,
                                delay: Math.random() * 2,
                            }}
                        />
                    ))}
                </div>

                <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {/* Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-md rounded-full border border-yellow-400/30 mb-8"
                    >
                        <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
                        <span className="text-yellow-300 font-semibold">Limited Time Offer</span>
                        <PartyPopper className="w-5 h-5 text-yellow-400" />
                    </motion.div>

                    {/* Main Title */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
                    >
                        <span className="bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                            Shubham Lucky Draw
                        </span>
                        <br />
                        <span className="text-3xl md:text-5xl lg:text-6xl">(₹1,00,000)</span>
                    </motion.h1>

                    {/* Tagline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-xl md:text-2xl text-white/80 mb-6"
                    >
                        {campaignInfo.tagline}
                    </motion.p>

                    {/* Prize Value Badge */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.5 }}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-2xl shadow-2xl shadow-yellow-500/30 mb-8"
                    >
                        <Trophy className="w-8 h-8 text-white" />
                        <div className="text-left">
                            <p className="text-white/80 text-sm font-medium">Total Prize Value</p>
                            <p className="text-white text-2xl md:text-3xl font-bold">{campaignInfo.totalPrizeValue}</p>
                        </div>
                    </motion.div>

                    {/* Campaign Period */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="flex flex-wrap items-center justify-center gap-6 mb-12"
                    >
                        <div className="flex items-center gap-2 text-white/70">
                            <Calendar className="w-5 h-5 text-blue-400" />
                            <span>Valid: {campaignInfo.period.start} - {campaignInfo.period.end}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/70">
                            <MapPin className="w-5 h-5 text-green-400" />
                            <span>All Sara Mobiles Stores</span>
                        </div>
                    </motion.div>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.7 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <button
                            onClick={() => setActiveTab("register")}
                            className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg shadow-yellow-500/30 flex items-center gap-2 text-lg"
                        >
                            <Send className="w-6 h-6" />
                            Register Now
                        </button>
                        <Link
                            href="/store-locator"
                            className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
                        >
                            <MapPin className="w-5 h-5" />
                            Find Nearest Store
                        </Link>
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2"
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <div className="w-8 h-12 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
                        <div className="w-1.5 h-3 bg-white/60 rounded-full"></div>
                    </div>
                </motion.div>
            </section>

            {/* Tab Navigation */}
            <section className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-white/10">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="flex overflow-x-auto scrollbar-hide">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-6 py-4 font-semibold whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                                    ? "text-yellow-400 border-yellow-400"
                                    : "text-white/60 border-transparent hover:text-white/80"
                                    }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Tab Content */}
            <section className="py-16">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <AnimatePresence mode="wait">
                        {/* Register Tab - Lead Form */}
                        {activeTab === "register" && (
                            <motion.div
                                key="register"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="text-center mb-12">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-full text-yellow-400 text-sm font-medium mb-4">
                                        <Send className="w-4 h-4" />
                                        Register
                                    </span>
                                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                        Enter the <span className="text-yellow-400">Lucky Draw</span>
                                    </h2>
                                    <p className="text-white/60 max-w-2xl mx-auto">
                                        Fill in your details below to participate in the Shubham Lucky Draw (₹1,00,000). Our team will contact you shortly.
                                    </p>
                                </div>

                                <div className="max-w-lg mx-auto bg-slate-800/50 backdrop-blur-md rounded-3xl p-8 border border-white/10">
                                    <LeadForm source="Shubham Lucky Draw" variant="dark" />
                                </div>
                            </motion.div>
                        )}

                        {/* Prizes Tab */}
                        {activeTab === "prizes" && (
                            <motion.div
                                key="prizes"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Grand Prizes */}
                                <div className="mb-16">
                                    <div className="text-center mb-12">
                                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 rounded-full text-yellow-400 text-sm font-medium mb-4">
                                            <Crown className="w-4 h-4" />
                                            Grand Prizes
                                        </span>
                                        <h2 className="text-3xl md:text-4xl font-bold text-white">
                                            Win <span className="text-yellow-400">Life-Changing</span> Packages
                                        </h2>
                                    </div>

                                    <div className="grid md:grid-cols-3 gap-6">
                                        {grandPrizes.map((prize, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                                className={`relative bg-slate-800/50 backdrop-blur-md rounded-3xl p-8 border border-white/10 overflow-hidden group hover:border-white/20 transition-all`}
                                            >
                                                {/* Glow Effect */}
                                                <div className={`absolute -top-20 -right-20 w-40 h-40 ${prize.bgGlow} rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity`}></div>

                                                {/* Prize Order Badge */}
                                                <div className={`absolute top-4 right-4 w-10 h-10 bg-gradient-to-br ${prize.color} rounded-full flex items-center justify-center font-bold text-white shadow-lg`}>
                                                    {index + 1}
                                                </div>

                                                <div className={`w-16 h-16 bg-gradient-to-br ${prize.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg`}>
                                                    <prize.icon className="w-8 h-8 text-white" />
                                                </div>

                                                <h3 className="text-xl font-bold text-white mb-2">{prize.title}</h3>
                                                <p className={`text-2xl font-bold bg-gradient-to-r ${prize.color} bg-clip-text text-transparent mb-4`}>
                                                    {prize.value}
                                                </p>

                                                <ul className="space-y-2">
                                                    {prize.items.map((item, i) => (
                                                        <li key={i} className="flex items-center gap-2 text-white/70 text-sm">
                                                            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Daily Prizes */}
                                <div className="mb-16">
                                    <div className="text-center mb-12">
                                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-4">
                                            <Zap className="w-4 h-4" />
                                            Daily Prizes
                                        </span>
                                        <h2 className="text-3xl md:text-4xl font-bold text-white">
                                            Exciting <span className="text-blue-400">Daily Draws</span>
                                        </h2>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {dailyPrizes.map((prize, index) => (
                                            <motion.div
                                                key={index}
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: index * 0.1 }}
                                                className="bg-slate-800/50 backdrop-blur-md rounded-2xl p-6 text-center border border-white/10 hover:border-blue-400/30 transition-all group"
                                            >
                                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
                                                    <prize.icon className="w-7 h-7 text-white" />
                                                </div>
                                                <h3 className="font-bold text-white mb-1">{prize.name}</h3>
                                                <p className="text-blue-400 text-sm font-medium">{prize.quantity}</p>
                                            </motion.div>
                                        ))}
                                    </div>
                                </div>

                                {/* Assured Gifts */}
                                <div>
                                    <div className="text-center mb-12">
                                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full text-green-400 text-sm font-medium mb-4">
                                            <Gift className="w-4 h-4" />
                                            Assured Gifts
                                        </span>
                                        <h2 className="text-3xl md:text-4xl font-bold text-white">
                                            Guaranteed <span className="text-green-400">Gifts</span> on Every Purchase
                                        </h2>
                                    </div>

                                    <div className="bg-slate-800/50 backdrop-blur-md rounded-3xl overflow-hidden border border-white/10">
                                        <div className="grid grid-cols-2 md:grid-cols-5">
                                            {assuredGifts.map((gift, index) => (
                                                <div
                                                    key={index}
                                                    className={`p-6 text-center ${index < assuredGifts.length - 1 ? 'border-r border-b md:border-b-0 border-white/10' : ''} ${index % 2 === 1 ? 'border-r-0 md:border-r' : ''}`}
                                                >
                                                    <p className="text-2xl font-bold text-green-400 mb-2">{gift.minPurchase}+</p>
                                                    <p className="text-white/70 text-sm">{gift.gift}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* How to Participate Tab */}
                        {activeTab === "participate" && (
                            <motion.div
                                key="participate"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="text-center mb-12">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-full text-purple-400 text-sm font-medium mb-4">
                                        <Ticket className="w-4 h-4" />
                                        Easy Steps
                                    </span>
                                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                        How to <span className="text-purple-400">Participate</span>
                                    </h2>
                                    <p className="text-white/60 max-w-2xl mx-auto">
                                        Follow these simple steps to enter the lucky draw and win amazing prizes!
                                    </p>
                                </div>

                                {/* In-Store Participation Box */}
                                <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-md rounded-3xl p-8 border border-purple-400/20 max-w-3xl mx-auto">
                                    <div className="text-center mb-6">
                                        <Ticket className="w-12 h-12 text-purple-400 mx-auto mb-4" />
                                        <h3 className="text-2xl font-bold text-white mb-2">
                                            In-Store Lucky Draw Participation
                                        </h3>
                                        <p className="text-white/60">
                                            Participate easily by filling the lucky draw coupon at the store
                                        </p>
                                    </div>

                                    <div className="bg-slate-900/50 rounded-2xl p-6 mb-6">
                                        <ul className="space-y-4 text-white/70 text-sm">
                                            <li className="flex gap-3">
                                                <span className="text-purple-400 font-bold">•</span>
                                                After purchase, collect the lucky draw coupon from the store.
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="text-purple-400 font-bold">•</span>
                                                Fill in all required details correctly.
                                            </li>
                                            <li className="flex gap-3">
                                                <span className="text-purple-400 font-bold">•</span>
                                                Drop the filled coupon at the store counter.
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="flex items-start gap-3 p-4 bg-yellow-500/10 rounded-xl border border-yellow-400/20">
                                        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-yellow-200/80 text-sm">
                                            <strong>Note:</strong> Lucky draw results will be announced at the end of the month in the store.
                                        </p>
                                    </div>
                                </div>

                            </motion.div>
                        )}

                        {/* Terms & Conditions Tab */}
                        {activeTab === "terms" && (
                            <motion.div
                                key="terms"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="text-center mb-12">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-4">
                                        <FileText className="w-4 h-4" />
                                        Legal
                                    </span>
                                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                        Terms & <span className="text-blue-400">Conditions</span>
                                    </h2>
                                    <p className="text-white/60 max-w-2xl mx-auto">
                                        Please read and understand the terms and conditions before participating in the lucky draw.
                                    </p>
                                </div>

                                <div className="max-w-4xl mx-auto space-y-4">
                                    {termsCategories.map((category, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="bg-slate-800/50 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10"
                                        >
                                            <button
                                                onClick={() => setExpandedTerms(expandedTerms === index ? null : index)}
                                                className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
                                            >
                                                <h3 className="text-lg font-bold text-white">{category.title}</h3>
                                                {expandedTerms === index ? (
                                                    <ChevronUp className="w-5 h-5 text-white/60" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-white/60" />
                                                )}
                                            </button>
                                            <AnimatePresence>
                                                {expandedTerms === index && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <ul className="px-6 pb-6 space-y-3">
                                                            {category.items.map((item, i) => (
                                                                <li key={i} className="flex items-start gap-3 text-white/70">
                                                                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />
                                                                    <span>{item}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* FAQ Tab */}
                        {activeTab === "faq" && (
                            <motion.div
                                key="faq"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="text-center mb-12">
                                    <span className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-full text-green-400 text-sm font-medium mb-4">
                                        <MessageSquare className="w-4 h-4" />
                                        Help
                                    </span>
                                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                        Frequently Asked <span className="text-green-400">Questions</span>
                                    </h2>
                                    <p className="text-white/60 max-w-2xl mx-auto">
                                        Find answers to common questions about the lucky draw campaign.
                                    </p>
                                </div>

                                <div className="max-w-4xl mx-auto space-y-4">
                                    {faqs.map((faq, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="bg-slate-800/50 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10"
                                        >
                                            <button
                                                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                                className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
                                            >
                                                <h3 className="text-lg font-semibold text-white pr-4">{faq.question}</h3>
                                                {expandedFaq === index ? (
                                                    <ChevronUp className="w-5 h-5 text-white/60 flex-shrink-0" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-white/60 flex-shrink-0" />
                                                )}
                                            </button>
                                            <AnimatePresence>
                                                {expandedFaq === index && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.3 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <p className="px-6 pb-6 text-white/70">{faq.answer}</p>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Contact Support */}
                                <div className="max-w-2xl mx-auto mt-12 text-center">
                                    <p className="text-white/60 mb-4">Still have questions?</p>
                                    <Link
                                        href="/contact"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors"
                                    >
                                        <Phone className="w-5 h-5" />
                                        Contact Support
                                    </Link>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="py-20 bg-gradient-to-r from-yellow-600/20 via-orange-600/20 to-red-600/20 border-t border-white/10">
                <div className="max-w-4xl mx-auto px-4 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <PartyPopper className="w-16 h-16 text-yellow-400 mx-auto mb-6" />
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                            Don&apos;t Miss This <span className="text-yellow-400">Opportunity!</span>
                        </h2>
                        <p className="text-xl text-white/70 mb-8">
                            Register now and stand a chance to win prizes worth {campaignInfo.totalPrizeValue}
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                onClick={() => { setActiveTab("register"); window.scrollTo({ top: 0, behavior: "smooth" }) }}
                                className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all shadow-xl shadow-yellow-500/30 flex items-center gap-2 text-lg"
                            >
                                <Send className="w-6 h-6" />
                                Register Now
                            </button>
                            <Link
                                href="/store-locator"
                                className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
                            >
                                <MapPin className="w-5 h-5" />
                                Visit a Store
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </div>
    )
}
