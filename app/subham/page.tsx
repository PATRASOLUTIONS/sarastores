"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import {
    Handshake,
    Building2,
    Tv,
    Smartphone,
    Laptop,
    Home,
    Zap,
    Shield,
    MapPin,
    Phone,
    Mail,
    ExternalLink,
    ChevronRight,
    Star,
    Users,
    Award,
    TrendingUp,
    CheckCircle2,
    ArrowRight,
    Sparkles,
    Send
} from "lucide-react"
import Header from "@/components/Header"
import Footer from "@/components/Footer"

// Shubham World Information
const shubhamInfo = {
    name: "Shubham World",
    fullName: "Shubham - The Electronic Shopee",
    tagline: "Auspicious Beginning, Lasting Relationship",
    founded: "1995",
    website: "https://www.shubhamworld.com",
    tollFree: "1800 313 7575",
    email: "info@shubhamworld.com",
    description: "India's fastest-growing electronic retail chain providing a One Stop Solution for electronics, mobiles, laptops, and furniture.",
    officeAddress: {
        registered: "#431, 1st N Block, Rajajinagar, Bangalore - 560010",
        corporate: "NO. CH- 22/2 Dwarka Road, Chamraja Mohalla, Mysuru - 570004"
    }
}

// Business Divisions
const businessDivisions = [
    {
        name: "Shubham The Electronic Shopee",
        description: "A leading retail chain across India specializing in consumer electronics with extensive store network.",
        icon: Tv,
        color: "from-red-500 to-red-600"
    },
    {
        name: "Shubham Samrudhi Infra",
        description: "Premier construction and infrastructure enterprise, awarded 'Leading Developer of the Year'.",
        icon: Building2,
        color: "from-green-500 to-green-600"
    },
    {
        name: "Shubham Electronic Care & IVEE",
        description: "Dedicated after-sales service and their own premium product line including home appliances.",
        icon: Shield,
        color: "from-blue-500 to-blue-600"
    }
]

// Product Categories
const productCategories = [
    { name: "Smart TVs", icon: Tv },
    { name: "Smartphones", icon: Smartphone },
    { name: "Laptops", icon: Laptop },
    { name: "Home Appliances", icon: Home }
    // { name: "Power Solutions", icon: Zap },
    // { name: "Furniture", icon: Building2 }
]

// Partnership Benefits
const partnershipBenefits = [
    {
        title: "Extended Warranty Services",
        description: "Enjoy extended warranty coverage on all products purchased through our partnership.",
        icon: Shield
    },
    {
        title: "Exclusive Deals",
        description: "Access special discounts and combo offers available only through this collaboration.",
        icon: Star
    },
    {
        title: "Pan-India Service Network",
        description: "Combined service network spanning across Karnataka and beyond with 50+ service centers.",
        icon: MapPin
    },
    {
        title: "Premium After-Sales Support",
        description: "Dedicated customer support team for all your queries and service requirements.",
        icon: Phone
    }
]

// Timeline
const timeline = [
    { year: "1995", event: "Shubham World founded, started distribution of BPL and LG brands" },
    { year: "2018", event: "Launched franchise concept, expanded across Karnataka" },
    { year: "2020", event: "Celebrated 25 years, began Pan-India expansion" },
    { year: "2024", event: "Partnership with Sara Mobiles & Electronics established" }
]

// Electronic Categories for Lead Generation
const electronicCategories = [
    "Smart TV",
    "LED TV",
    "OLED TV",
    "Refrigerator",
    "Washing Machine",
    "Air Conditioner",
    "Microwave Oven",
    "Dishwasher",
    "Water Purifier",
    "Smartphone",
    "Laptop",
    "Desktop Computer",
    "Tablet",
    "Smart Watch",
    "Wireless Earbuds",
    "Headphones",
    "Speaker System",
    "Soundbar",
    "Home Theater",
    "Gaming Console",
    "Camera",
    "Printer",
    "Vacuum Cleaner",
    "Air Purifier",
    "Geyser",
    "Induction Cooktop",
    "Mixer Grinder",
    "Juicer",
    "Electric Kettle",
    "Toaster",
    "Iron",
    "Ceiling Fan",
    "Table Fan",
    "Cooler",
    "Stabilizer",
    "Inverter",
    "UPS",
    "Other"
]

export default function ShubhamCollaborationPage() {
    const [isVisible, setIsVisible] = useState(false)
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        category: "",
        message: ""
    })
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        setIsVisible(true)
    }, [])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            // Here you would typically send the data to your API
            // For now, we'll just simulate a submission
            await new Promise(resolve => setTimeout(resolve, 1500))

            // Show success message (you can use toast notification library)
            alert("Thank you for your interest! We'll contact you soon.")

            // Reset form
            setFormData({
                name: "",
                email: "",
                phone: "",
                category: "",
                message: ""
            })
        } catch (error) {
            alert("Something went wrong. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <Header />

            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                {/* Animated Background */}
                <div className="absolute inset-0">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
                    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/10 to-red-500/10 rounded-full blur-3xl"></div>
                </div>

                <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    {/* Partnership Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500/20 to-red-500/20 backdrop-blur-md rounded-full border border-white/20 mb-8"
                    >
                        <Handshake className="w-5 h-5 text-yellow-400" />
                        <span className="text-white font-medium">Strategic Partnership</span>
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                    </motion.div>

                    {/* Logos */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 mb-12"
                    >
                        {/* Sara Mobiles Logo */}
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-2xl p-4 shadow-2xl flex items-center justify-center">
                                <div className="text-center">
                                    <span className="text-2xl md:text-3xl font-bold text-blue-600">Sara</span>
                                    <span className="text-2xl md:text-3xl font-bold text-gray-800"> Mobiles</span>
                                </div>
                            </div>
                            <span className="text-white/80 mt-3 text-sm">& Electronics</span>
                        </div>

                        {/* Handshake Icon */}
                        <div className="hidden md:flex items-center justify-center">
                            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/30 animate-bounce">
                                <Handshake className="w-10 h-10 text-white" />
                            </div>
                        </div>

                        {/* Shubham World Logo */}
                        <div className="flex flex-col items-center">
                            <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-2xl p-4 shadow-2xl flex items-center justify-center">
                                <div className="text-center">
                                    <span className="text-2xl md:text-3xl font-bold text-red-600">SHUBHAM</span>
                                    <p className="text-xs text-gray-500 mt-1">The Electronic Shopee</p>
                                </div>
                            </div>
                            <span className="text-white/80 mt-3 text-sm">World</span>
                        </div>
                    </motion.div>

                    {/* Title */}
                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6"
                    >
                        Stronger{" "}
                        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-red-400 bg-clip-text text-transparent">
                            Together
                        </span>
                    </motion.h1>

                    {/* Tagline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="text-xl md:text-2xl text-white/80 mb-8 max-w-3xl mx-auto"
                    >
                        {shubhamInfo.tagline}
                    </motion.p>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.7 }}
                        className="text-lg text-white/60 mb-12 max-w-2xl mx-auto"
                    >
                        Two trusted names in electronics retail, united to bring you the best products, prices, and service across India.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.8 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link
                            href="/products"
                            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
                        >
                            Explore Products
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                        <a
                            href={shubhamInfo.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all flex items-center gap-2"
                        >
                            Visit Shubham World
                            <ExternalLink className="w-5 h-5" />
                        </a>
                    </motion.div>
                </div>

                {/* Scroll Indicator */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                    <div className="w-8 h-12 border-2 border-white/30 rounded-full flex items-start justify-center p-2">
                        <div className="w-1.5 h-3 bg-white/60 rounded-full animate-pulse"></div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-16 bg-white border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { value: "29+", label: "Years of Excellence", icon: Award },
                            { value: "50+", label: "Store Locations", icon: MapPin },
                            { value: "1M+", label: "Happy Customers", icon: Users },
                            { value: "100%", label: "Quality Assurance", icon: CheckCircle2 }
                        ].map((stat, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className="text-center p-6"
                            >
                                <stat.icon className="w-10 h-10 text-blue-600 mx-auto mb-4" />
                                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{stat.value}</div>
                                <div className="text-gray-600">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* About Shubham World */}
            <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <span className="inline-block px-4 py-2 bg-red-100 text-red-600 rounded-full text-sm font-medium mb-4">
                            Our Partner
                        </span>
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
                            About <span className="text-red-600">Shubham World</span>
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            {shubhamInfo.description}
                        </p>
                    </motion.div>

                    {/* Business Divisions */}
                    <div className="grid md:grid-cols-3 gap-8 mb-16">
                        {businessDivisions.map((division, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all border border-gray-100 group"
                            >
                                <div className={`w-16 h-16 bg-gradient-to-br ${division.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <division.icon className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-3">{division.name}</h3>
                                <p className="text-gray-600">{division.description}</p>
                            </motion.div>
                        ))}
                    </div>

                    {/* Timeline */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="bg-gradient-to-r from-slate-900 to-blue-900 rounded-3xl p-8 md:p-12"
                    >
                        <h3 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
                            Our Journey Together
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {timeline.map((item, index) => (
                                <div key={index} className="text-center group">
                                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/30">
                                        <span className="text-white font-bold">{item.year}</span>
                                    </div>
                                    <p className="text-white/80 text-sm">{item.event}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Product Categories */}
            <section className="py-20 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <span className="inline-block px-4 py-2 bg-blue-100 text-blue-600 rounded-full text-sm font-medium mb-4">
                            Product Range
                        </span>
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
                            Complete Electronics <span className="text-blue-600">Solution</span>
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            From cutting-edge smartphones to home appliances, we&apos;ve got everything you need under one roof.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {productCategories.map((category, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, scale: 0.9 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 text-center hover:shadow-xl transition-all group cursor-pointer border border-gray-200 hover:border-blue-300"
                            >
                                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-md group-hover:shadow-lg group-hover:scale-110 transition-all">
                                    <category.icon className="w-8 h-8 text-blue-600" />
                                </div>
                                <h3 className="font-semibold text-gray-900">{category.name}</h3>
                            </motion.div>
                        ))}
                    </div>

                    {/* CTA to Products */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mt-12"
                    >
                        <Link
                            href="/products"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
                        >
                            Browse All Products
                            <ChevronRight className="w-5 h-5" />
                        </Link>
                    </motion.div>
                </div>
            </section>

            {/* Partnership Benefits */}
            <section className="py-20 bg-gradient-to-b from-blue-50 to-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <span className="inline-block px-4 py-2 bg-green-100 text-green-600 rounded-full text-sm font-medium mb-4">
                            Why Choose Us
                        </span>
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
                            Partnership <span className="text-green-600">Benefits</span>
                        </h2>
                        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                            Experience the advantages of our strategic collaboration that puts customers first.
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {partnershipBenefits.map((benefit, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                className="flex items-start gap-6 bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-gray-100"
                            >
                                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <benefit.icon className="w-7 h-7 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{benefit.title}</h3>
                                    <p className="text-gray-600">{benefit.description}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-16"
                    >
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                            Get In <span className="text-blue-400">Touch</span>
                        </h2>
                        <p className="text-xl text-white/70 max-w-3xl mx-auto">
                            Have questions about our partnership or products? We&apos;re here to help!
                        </p>
                    </motion.div>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Sara Mobiles Contact */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Sara Mobiles & Electronics</h3>
                                    <p className="text-white/60">Your Trusted Electronics Partner</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <a href="tel:+917892051553" className="flex items-center gap-3 text-white/80 hover:text-white transition-colors">
                                    <Phone className="w-5 h-5" />
                                    <span>+91 78920 51553</span>
                                </a>
                                <a href="mailto:info@saramobiles.com" className="flex items-center gap-3 text-white/80 hover:text-white transition-colors">
                                    <Mail className="w-5 h-5" />
                                    <span>info@saramobiles.com</span>
                                </a>
                                <Link href="/store-locator" className="flex items-center gap-3 text-white/80 hover:text-white transition-colors">
                                    <MapPin className="w-5 h-5" />
                                    <span>View Store Locations</span>
                                </Link>
                            </div>
                            <Link
                                href="/contact"
                                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
                            >
                                Contact Us
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </motion.div>

                        {/* Shubham World Contact */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Shubham World</h3>
                                    <p className="text-white/60">The Electronic Shopee</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <a href={`tel:${shubhamInfo.tollFree.replace(/\s/g, '')}`} className="flex items-center gap-3 text-white/80 hover:text-white transition-colors">
                                    <Phone className="w-5 h-5" />
                                    <span>Toll-Free: {shubhamInfo.tollFree}</span>
                                </a>
                                <a href={`mailto:${shubhamInfo.email}`} className="flex items-center gap-3 text-white/80 hover:text-white transition-colors">
                                    <Mail className="w-5 h-5" />
                                    <span>{shubhamInfo.email}</span>
                                </a>
                                <div className="flex items-start gap-3 text-white/80">
                                    <MapPin className="w-5 h-5 mt-1 flex-shrink-0" />
                                    <span>{shubhamInfo.officeAddress.registered}</span>
                                </div>
                            </div>
                            <a
                                href={shubhamInfo.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-colors"
                            >
                                Visit Website
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Lead Generation Form */}
            <section className="py-20 bg-gradient-to-b from-white to-gray-50">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <span className="inline-block px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 rounded-full text-sm font-medium mb-4">
                            Get Started
                        </span>
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
                            Lead <span className="text-blue-600">Generation</span>
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Interested in our products? Fill out the form below and our team will get in touch with you shortly.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-100"
                    >
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Name Field */}
                            <div>
                                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    placeholder="Enter your full name"
                                />
                            </div>

                            {/* Email and Phone Row */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Email Address <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="your.email@example.com"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Phone Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        required
                                        pattern="[0-9]{10}"
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="10-digit mobile number"
                                    />
                                </div>
                            </div>

                            {/* Category Dropdown */}
                            <div>
                                <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Product Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="category"
                                    name="category"
                                    value={formData.category}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                                >
                                    <option value="">Select a product category</option>
                                    {electronicCategories.map((category, index) => (
                                        <option key={index} value={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Message Field */}
                            <div>
                                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Message (Optional)
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleInputChange}
                                    rows={4}
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    placeholder="Tell us more about your requirements..."
                                />
                            </div>

                            {/* Submit Button */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-5 h-5" />
                                            Submit Inquiry
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Privacy Note */}
                            <p className="text-sm text-gray-500 text-center">
                                By submitting this form, you agree to our privacy policy. We respect your privacy and will never share your information.
                            </p>
                        </form>
                    </motion.div>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                    >
                        <div className="inline-flex items-center gap-3 mb-8">
                            <TrendingUp className="w-8 h-8 text-green-500" />
                            <span className="text-green-600 font-semibold text-lg">Growing Together</span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
                            Ready to Experience the Best?
                        </h2>
                        <p className="text-xl text-gray-600 mb-8">
                            Browse our extensive collection of electronics and enjoy the benefits of our partnership with Shubham World.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link
                                href="/products"
                                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg flex items-center gap-2"
                            >
                                Shop Now
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                            <Link
                                href="/store-locator"
                                className="px-8 py-4 bg-gray-100 text-gray-800 font-semibold rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2"
                            >
                                Find a Store
                                <MapPin className="w-5 h-5" />
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </div>
    )
}
