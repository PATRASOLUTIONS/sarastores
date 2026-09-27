"use client"

import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import toast from "react-hot-toast"
import {
    ArrowLeft,
    Save,
    Plus,
    Trash2,
    GripVertical,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    Loader2,
    Image as ImageIcon,
    Type,
    Palette,
    Layout,
    ShoppingBag,
    Award,
    MessageSquare,
    Star,
    Shield,
    Zap,
    Settings,
    Wrench,
    CheckCircle,
    Sparkles,
    Heart,
    Globe,
    ExternalLink,
} from "lucide-react"

// All available lucide icons for picking
const ICON_OPTIONS = [
    "Shield", "Zap", "Award", "Star", "Settings", "Wrench", "CheckCircle",
    "Sparkles", "Heart", "Globe", "ShoppingBag", "MessageSquare",
]

const ICON_MAP: Record<string, any> = {
    Shield, Zap, Award, Star, Settings, Wrench, CheckCircle,
    Sparkles, Heart, Globe, ShoppingBag, MessageSquare,
}

const COLOR_OPTIONS = [
    { name: "Blue", value: "blue", bg: "bg-blue-500" },
    { name: "Red", value: "red", bg: "bg-red-500" },
    { name: "Green", value: "green", bg: "bg-green-500" },
    { name: "Purple", value: "purple", bg: "bg-purple-500" },
    { name: "Orange", value: "orange", bg: "bg-orange-500" },
    { name: "Yellow", value: "yellow", bg: "bg-yellow-500" },
    { name: "Pink", value: "pink", bg: "bg-pink-500" },
    { name: "Indigo", value: "indigo", bg: "bg-indigo-500" },
    { name: "Teal", value: "teal", bg: "bg-teal-500" },
    { name: "Cyan", value: "cyan", bg: "bg-cyan-500" },
    { name: "Gray", value: "gray", bg: "bg-gray-500" },
]

const TEXT_COLOR_OPTIONS = [
    "text-blue-400", "text-red-400", "text-green-400", "text-purple-400",
    "text-yellow-400", "text-pink-400", "text-indigo-400", "text-teal-400",
    "text-cyan-400", "text-orange-400", "text-white",
]

const BADGE_COLOR_OPTIONS = [
    "bg-blue-50 text-blue-600",
    "bg-red-50 text-red-600",
    "bg-green-50 text-green-600",
    "bg-purple-50 text-purple-600",
    "bg-orange-50 text-orange-600",
    "bg-yellow-50 text-yellow-600",
    "bg-pink-50 text-pink-600",
    "bg-indigo-50 text-indigo-600",
]

const GRADIENT_OPTIONS = [
    "from-blue-600 to-blue-500",
    "from-red-600 to-red-500",
    "from-green-600 to-green-500",
    "from-purple-600 to-purple-500",
    "from-orange-600 to-orange-500",
    "from-indigo-600 to-indigo-500",
    "from-teal-600 to-teal-500",
    "from-pink-600 to-pink-500",
    "from-gray-800 to-gray-700",
    "from-yellow-600 to-yellow-500",
]

const TRUST_BG_OPTIONS = [
    "from-blue-900 via-blue-800 to-blue-900",
    "from-red-900 via-red-800 to-red-900",
    "from-green-900 via-green-800 to-green-900",
    "from-purple-900 via-purple-800 to-purple-900",
    "from-gray-900 via-gray-800 to-gray-900",
    "from-indigo-900 via-indigo-800 to-indigo-900",
    "from-teal-900 via-teal-800 to-teal-900",
]

const ICON_BG_OPTIONS = [
    "bg-blue-600/20", "bg-green-600/20", "bg-yellow-600/20",
    "bg-red-600/20", "bg-purple-600/20", "bg-pink-600/20",
    "bg-indigo-600/20", "bg-teal-600/20",
]

const ICON_TEXT_OPTIONS = [
    "text-blue-300", "text-green-300", "text-yellow-300",
    "text-red-300", "text-purple-300", "text-pink-300",
    "text-indigo-300", "text-teal-300", "text-white",
]

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
    banners: { url: string;
 alt: string; link?: string }[]
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
    leadFormSource: string
}

// Collapsible Section component
function Section({
    title,
    icon: Icon,
    children,
    defaultOpen = false,
}: {
    title: string
    icon: any
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-gray-900">{title}</span>
                </div>
                {open ? (
                    <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
            </button>
            {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
        </div>
    )
}

export default function AdminBrandEditorPage() {
    const router = useRouter()
    const params = useParams()
    const brandId = params.id as string

    const [brand, setBrand] = useState<BrandData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const fetchBrand = async () => {
            try {
                const res = await apiFetch("/api/brands")
                const data = await res.json()
                if (data.success) {
                    const found = data.brands.find((b: any) => b._id === brandId)
                    if (found) {
                        // Ensure all nested objects exist with defaults
                        setBrand({
                            ...found,
                            banners: found.banners || [],
                            categories: found.categories || [],
                            features: found.features || [],
                            whyChoose: found.whyChoose || {
                                title: "Why Choose Us",
                                heading: `Why Choose ${found.name}?`,
                                subtitle: "",
                                reasons: [],
                            },
                            productsSection: found.productsSection || {
                                badge: "Featured Products",
                                badgeColor: "bg-red-50 text-red-600",
                                heading: `Shop ${found.name} Products`,
                                subtitle: "",
                                manufacturerFilter: found.name.toLowerCase(),
                                maxProducts: 12,
                                ctaText: `View All ${found.name} Products`,
                                ctaLink: `/products?brands=${found.name}`,
                            },
                            categorySection: found.categorySection || {
                                badge: "Explore Categories",
                                badgeColor: "bg-blue-50 text-blue-600",
                                heading: `${found.name} Product Categories`,
                                subtitle: "",
                            },
                            trustBadges: found.trustBadges || [],
                            heroContent: found.heroContent || {
                                title: found.name.toUpperCase(),
                                subtitle: found.tagline || "",
                                description: found.description || "",
                                ctaText: `Shop ${found.name} Products`,
                                ctaLink: `/products?brands=${found.name}`,
                                ctaColor: "from-blue-600 to-blue-500",
                                secondaryCta: "Learn More",
                            },
                            leadFormEnabled: found.leadFormEnabled ?? false,
                            leadFormSource: found.leadFormSource || `${found.name} Brand Page`,
                        })
                    } else {
                        toast.error("Brand not found")
                        router.push("/admin/brands")
                    }
                }
            } catch (error) {
                toast.error("Failed to load brand")
            } finally {
                setLoading(false)
            }
        }
        fetchBrand()
    }, [brandId, router])

    const handleSave = async () => {
        if (!brand) return
        setSaving(true)
        try {
            const { _id, ...updates } = brand
            const res = await apiFetch("/api/brands", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: _id, ...updates }),
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Brand saved successfully!")
            } else {
                toast.error(data.message || "Failed to save")
            }
        } catch (error) {
            toast.error("Failed to save brand")
        } finally {
            setSaving(false)
        }
    }

    const updateBrand = (updates: Partial<BrandData>) => {
        if (brand) setBrand({ ...brand, ...updates })
    }

    // Array item helpers
    const addBanner = () => {
        if (!brand) return
        setBrand({
            ...brand,
            banners: [...brand.banners, { url: "", alt: "", link: "" }],
        })
    }

    const removeBanner = (index: number) => {
        if (!brand) return
        setBrand({
            ...brand,
            banners: brand.banners.filter((_, i) => i !== index),
        })
    }

    const updateBanner = (index: number, field: string, value: string) => {
        if (!brand) return
        const banners = [...brand.banners]
        banners[index] = { ...banners[index], [field]: value }
        setBrand({ ...brand, banners })
    }

    const addCategory = () => {
        if (!brand) return
        setBrand({
            ...brand,
            categories: [...brand.categories, { url: "", title: "", description: "", link: "" }],
        })
    }

    const removeCategory = (index: number) => {
        if (!brand) return
        setBrand({
            ...brand,
            categories: brand.categories.filter((_, i) => i !== index),
        })
    }

    const updateCategory = (index: number, field: string, value: string) => {
        if (!brand) return
        const categories = [...brand.categories]
        categories[index] = { ...categories[index], [field]: value }
        setBrand({ ...brand, categories })
    }

    const addFeature = () => {
        if (!brand) return
        setBrand({
            ...brand,
            features: [...brand.features, { icon: "Star", text: "", color: "text-blue-400" }],
        })
    }

    const removeFeature = (index: number) => {
        if (!brand) return
        setBrand({
            ...brand,
            features: brand.features.filter((_, i) => i !== index),
        })
    }

    const updateFeature = (index: number, field: string, value: string) => {
        if (!brand) return
        const features = [...brand.features]
        features[index] = { ...features[index], [field]: value }
        setBrand({ ...brand, features })
    }

    const addReason = () => {
        if (!brand) return
        setBrand({
            ...brand,
            whyChoose: {
                ...brand.whyChoose,
                reasons: [
                    ...brand.whyChoose.reasons,
                    { icon: "CheckCircle", title: "", description: "" },
                ],
            },
        })
    }

    const removeReason = (index: number) => {
        if (!brand) return
        setBrand({
            ...brand,
            whyChoose: {
                ...brand.whyChoose,
                reasons: brand.whyChoose.reasons.filter((_, i) => i !== index),
            },
        })
    }

    const updateReason = (index: number, field: string, value: string) => {
        if (!brand) return
        const reasons = [...brand.whyChoose.reasons]
        reasons[index] = { ...reasons[index], [field]: value }
        setBrand({
            ...brand,
            whyChoose: { ...brand.whyChoose, reasons },
        })
    }

    const addTrustBadge = () => {
        if (!brand) return
        setBrand({
            ...brand,
            trustBadges: [
                ...brand.trustBadges,
                {
                    icon: "Star",
                    iconColor: "text-blue-300",
                    bgColor: "bg-blue-600/20",
                    title: "",
                    subtitle: "",
                },
            ],
        })
    }

    const removeTrustBadge = (index: number) => {
        if (!brand) return
        setBrand({
            ...brand,
            trustBadges: brand.trustBadges.filter((_, i) => i !== index),
        })
    }

    const updateTrustBadge = (index: number, field: string, value: string) => {
        if (!brand) return
        const trustBadges = [...brand.trustBadges]
        trustBadges[index] = { ...trustBadges[index], [field]: value }
        setBrand({ ...brand, trustBadges })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    if (!brand) return null

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push("/admin/brands")}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Edit: {brand.name}
                        </h1>
                        <p className="text-sm text-gray-500">
                            /brands/{brand.slug}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <a
                        href={`/brands/${brand.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Preview
                    </a>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save Changes
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {/* Basic Info */}
                <Section title="Basic Information" icon={Type} defaultOpen={true}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Brand Name
                            </label>
                            <input
                                type="text"
                                value={brand.name}
                                onChange={(e) => updateBrand({ name: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                URL Slug
                            </label>
                            <input
                                type="text"
                                value={brand.slug}
                                onChange={(e) => updateBrand({ slug: e.target.value })}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tagline
                            </label>
                            <input
                                type="text"
                                value={brand.tagline}
                                onChange={(e) => updateBrand({ tagline: e.target.value })}
                                placeholder="e.g. Invented for life"
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Logo URL
                            </label>
                            <input
                                type="text"
                                value={brand.logo}
                                onChange={(e) => updateBrand({ logo: e.target.value })}
                                placeholder="https://..."
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Description
                            </label>
                            <textarea
                                value={brand.description}
                                onChange={(e) => updateBrand({ description: e.target.value })}
                                rows={3}
                                placeholder="Brief description of the brand..."
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-3 md:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Status:</label>
                            <button
                                onClick={() => updateBrand({ enabled: !brand.enabled })}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                                    brand.enabled
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                }`}
                            >
                                {brand.enabled ? (
                                    <>
                                        <Eye className="h-4 w-4" /> Enabled (Live)
                                    </>
                                ) : (
                                    <>
                                        <EyeOff className="h-4 w-4" /> Disabled
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </Section>

                {/* Colors & Theme */}
                <Section title="Colors & Theme" icon={Palette}>
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Accent Color
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {COLOR_OPTIONS.map((c) => (
                                    <button
                                        key={c.value}
                                        onClick={() => updateBrand({ accentColor: c.value })}
                                        className={`w-10 h-10 rounded-lg ${c.bg} ${
                                            brand.accentColor === c.value
                                                ? "ring-2 ring-offset-2 ring-blue-500"
                                                : ""
                                        } transition-all`}
                                        title={c.name}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    CTA Button Gradient
                                </label>
                                <select
                                    value={brand.heroContent?.ctaColor || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            heroContent: { ...brand.heroContent, ctaColor: e.target.value },
                                            accentColorFrom: `from-${e.target.value.split(" ")[0].replace("from-", "")}`,
                                            accentColorTo: e.target.value.split(" ")[1] || brand.accentColorTo,
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl"
                                >
                                    {GRADIENT_OPTIONS.map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Trust Section Background
                                </label>
                                <select
                                    value={brand.trustBadgeBg}
                                    onChange={(e) => updateBrand({ trustBadgeBg: e.target.value })}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl"
                                >
                                    {TRUST_BG_OPTIONS.map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Hero Content */}
                <Section title="Hero Section" icon={Layout}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hero Title
                                </label>
                                <input
                                    type="text"
                                    value={brand.heroContent?.title || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            heroContent: { ...brand.heroContent, title: e.target.value },
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Subtitle / Tagline
                                </label>
                                <input
                                    type="text"
                                    value={brand.heroContent?.subtitle || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            heroContent: { ...brand.heroContent, subtitle: e.target.value },
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Hero Description
                            </label>
                            <textarea
                                value={brand.heroContent?.description || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        heroContent: { ...brand.heroContent, description: e.target.value },
                                    })
                                }
                                rows={3}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    CTA Button Text
                                </label>
                                <input
                                    type="text"
                                    value={brand.heroContent?.ctaText || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            heroContent: { ...brand.heroContent, ctaText: e.target.value },
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    CTA Link
                                </label>
                                <input
                                    type="text"
                                    value={brand.heroContent?.ctaLink || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            heroContent: { ...brand.heroContent, ctaLink: e.target.value },
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Secondary CTA Text
                                </label>
                                <input
                                    type="text"
                                    value={brand.heroContent?.secondaryCta || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            heroContent: { ...brand.heroContent, secondaryCta: e.target.value },
                                        })
                                    }
                                    placeholder="Learn More"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    CTA Button Color
                                </label>
                                <select
                                    value={brand.heroContent?.ctaColor || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            heroContent: { ...brand.heroContent, ctaColor: e.target.value },
                                        })
                                    }
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl"
                                >
                                    {GRADIENT_OPTIONS.map((g) => (
                                        <option key={g} value={g}>
                                            {g}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </Section>

                {/* Banners */}
                <Section title="Banner Images" icon={ImageIcon}>
                    <div className="space-y-4">
                        {brand.banners.map((banner, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl"
                            >
                                <GripVertical className="h-5 w-5 text-gray-400 mt-2 flex-shrink-0" />
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Image URL
                                        </label>
                                        <input
                                            type="text"
                                            value={banner.url}
                                            onChange={(e) =>
                                                updateBanner(index, "url", e.target.value)
                                            }
                                            placeholder="https://..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Alt Text
                                        </label>
                                        <input
                                            type="text"
                                            value={banner.alt}
                                            onChange={(e) =>
                                                updateBanner(index, "alt", e.target.value)
                                            }
                                            placeholder="Description"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Link (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={banner.link || ""}
                                            onChange={(e) =>
                                                updateBanner(index, "link", e.target.value)
                                            }
                                            placeholder="/products?..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                                {banner.url && (
                                    <img
                                        src={banner.url}
                                        alt={banner.alt}
                                        className="w-16 h-10 rounded object-cover flex-shrink-0"
                                    />
                                )}
                                <button
                                    onClick={() => removeBanner(index)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addBanner}
                            className="flex items-center gap-2 text-blue-600 text-sm font-medium hover:text-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Banner
                        </button>
                    </div>
                </Section>

                {/* Features Strip */}
                <Section title="Feature Strip (Below Banner)" icon={Zap}>
                    <div className="space-y-4">
                        {brand.features.map((feature, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                            >
                                <select
                                    value={feature.icon}
                                    onChange={(e) =>
                                        updateFeature(index, "icon", e.target.value)
                                    }
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-36"
                                >
                                    {ICON_OPTIONS.map((i) => (
                                        <option key={i} value={i}>
                                            {i}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={feature.text}
                                    onChange={(e) =>
                                        updateFeature(index, "text", e.target.value)
                                    }
                                    placeholder="Feature text"
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <select
                                    value={feature.color}
                                    onChange={(e) =>
                                        updateFeature(index, "color", e.target.value)
                                    }
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
                                >
                                    {TEXT_COLOR_OPTIONS.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => removeFeature(index)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addFeature}
                            className="flex items-center gap-2 text-blue-600 text-sm font-medium hover:text-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Feature
                        </button>
                    </div>
                </Section>

                {/* Categories Section */}
                <Section title="Category Gallery" icon={Layout}>
                    <div className="space-y-4">
                        {/* Section Header Config */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Badge Text
                                </label>
                                <input
                                    type="text"
                                    value={brand.categorySection?.badge || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            categorySection: {
                                                ...brand.categorySection,
                                                badge: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Badge Color
                                </label>
                                <select
                                    value={brand.categorySection?.badgeColor || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            categorySection: {
                                                ...brand.categorySection,
                                                badgeColor: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                >
                                    {BADGE_COLOR_OPTIONS.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Heading
                                </label>
                                <input
                                    type="text"
                                    value={brand.categorySection?.heading || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            categorySection: {
                                                ...brand.categorySection,
                                                heading: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Subtitle
                                </label>
                                <input
                                    type="text"
                                    value={brand.categorySection?.subtitle || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            categorySection: {
                                                ...brand.categorySection,
                                                subtitle: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                        </div>

                        {/* Category Items */}
                        {brand.categories.map((cat, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl"
                            >
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            value={cat.title}
                                            onChange={(e) =>
                                                updateCategory(index, "title", e.target.value)
                                            }
                                            placeholder="Power Tools"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Description
                                        </label>
                                        <input
                                            type="text"
                                            value={cat.description}
                                            onChange={(e) =>
                                                updateCategory(
                                                    index,
                                                    "description",
                                                    e.target.value
                                                )
                                            }
                                            placeholder="Professional Grade"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Image URL
                                        </label>
                                        <input
                                            type="text"
                                            value={cat.url}
                                            onChange={(e) =>
                                                updateCategory(index, "url", e.target.value)
                                            }
                                            placeholder="https://..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Link (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={cat.link || ""}
                                            onChange={(e) =>
                                                updateCategory(index, "link", e.target.value)
                                            }
                                            placeholder="/products?brands=..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                                {cat.url && (
                                    <img
                                        src={cat.url}
                                        alt={cat.title}
                                        className="w-14 h-14 rounded object-cover flex-shrink-0"
                                    />
                                )}
                                <button
                                    onClick={() => removeCategory(index)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg flex-shrink-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addCategory}
                            className="flex items-center gap-2 text-blue-600 text-sm font-medium hover:text-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Category
                        </button>
                    </div>
                </Section>

                {/* Why Choose Section */}
                <Section title="Why Choose Section" icon={Award}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-purple-50 rounded-xl">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Heading
                                </label>
                                <input
                                    type="text"
                                    value={brand.whyChoose?.heading || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            whyChoose: {
                                                ...brand.whyChoose,
                                                heading: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Subtitle
                                </label>
                                <input
                                    type="text"
                                    value={brand.whyChoose?.subtitle || ""}
                                    onChange={(e) =>
                                        updateBrand({
                                            whyChoose: {
                                                ...brand.whyChoose,
                                                subtitle: e.target.value,
                                            },
                                        })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                        </div>

                        {brand.whyChoose?.reasons?.map((reason, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl"
                            >
                                <select
                                    value={reason.icon}
                                    onChange={(e) =>
                                        updateReason(index, "icon", e.target.value)
                                    }
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-36"
                                >
                                    {ICON_OPTIONS.map((i) => (
                                        <option key={i} value={i}>
                                            {i}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex-1 space-y-2">
                                    <input
                                        type="text"
                                        value={reason.title}
                                        onChange={(e) =>
                                            updateReason(index, "title", e.target.value)
                                        }
                                        placeholder="Title"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                    <input
                                        type="text"
                                        value={reason.description}
                                        onChange={(e) =>
                                            updateReason(index, "description", e.target.value)
                                        }
                                        placeholder="Description"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <button
                                    onClick={() => removeReason(index)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addReason}
                            className="flex items-center gap-2 text-blue-600 text-sm font-medium hover:text-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Reason
                        </button>
                    </div>
                </Section>

                {/* Products Section */}
                <Section title="Products Section" icon={ShoppingBag}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Badge Text
                            </label>
                            <input
                                type="text"
                                value={brand.productsSection?.badge || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            badge: e.target.value,
                                        },
                                    })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Badge Color
                            </label>
                            <select
                                value={brand.productsSection?.badgeColor || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            badgeColor: e.target.value,
                                        },
                                    })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            >
                                {BADGE_COLOR_OPTIONS.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Section Heading
                            </label>
                            <input
                                type="text"
                                value={brand.productsSection?.heading || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            heading: e.target.value,
                                        },
                                    })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Subtitle
                            </label>
                            <input
                                type="text"
                                value={brand.productsSection?.subtitle || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            subtitle: e.target.value,
                                        },
                                    })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Manufacturer Filter
                            </label>
                            <input
                                type="text"
                                value={brand.productsSection?.manufacturerFilter || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            manufacturerFilter: e.target.value,
                                        },
                                    })
                                }
                                placeholder="bosch"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                Used to filter products by manufacturer name (case-insensitive match)
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Max Products to Show
                            </label>
                            <input
                                type="number"
                                value={brand.productsSection?.maxProducts || 12}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            maxProducts: parseInt(e.target.value) || 12,
                                        },
                                    })
                                }
                                min={1}
                                max={50}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                CTA Button Text
                            </label>
                            <input
                                type="text"
                                value={brand.productsSection?.ctaText || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            ctaText: e.target.value,
                                        },
                                    })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                CTA Link
                            </label>
                            <input
                                type="text"
                                value={brand.productsSection?.ctaLink || ""}
                                onChange={(e) =>
                                    updateBrand({
                                        productsSection: {
                                            ...brand.productsSection,
                                            ctaLink: e.target.value,
                                        },
                                    })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                </Section>

                {/* Trust Badges */}
                <Section title="Trust Badges" icon={Shield}>
                    <div className="space-y-4">
                        {brand.trustBadges.map((badge, index) => (
                            <div
                                key={index}
                                className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl"
                            >
                                <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Icon
                                        </label>
                                        <select
                                            value={badge.icon}
                                            onChange={(e) =>
                                                updateTrustBadge(index, "icon", e.target.value)
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        >
                                            {ICON_OPTIONS.map((i) => (
                                                <option key={i} value={i}>
                                                    {i}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            value={badge.title}
                                            onChange={(e) =>
                                                updateTrustBadge(index, "title", e.target.value)
                                            }
                                            placeholder="130+ Years"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Subtitle
                                        </label>
                                        <input
                                            type="text"
                                            value={badge.subtitle}
                                            onChange={(e) =>
                                                updateTrustBadge(index, "subtitle", e.target.value)
                                            }
                                            placeholder="Of Innovation"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Icon Color
                                        </label>
                                        <select
                                            value={badge.iconColor}
                                            onChange={(e) =>
                                                updateTrustBadge(
                                                    index,
                                                    "iconColor",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        >
                                            {ICON_TEXT_OPTIONS.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">
                                            Background Color
                                        </label>
                                        <select
                                            value={badge.bgColor}
                                            onChange={(e) =>
                                                updateTrustBadge(
                                                    index,
                                                    "bgColor",
                                                    e.target.value
                                                )
                                            }
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        >
                                            {ICON_BG_OPTIONS.map((c) => (
                                                <option key={c} value={c}>
                                                    {c}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    onClick={() => removeTrustBadge(index)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addTrustBadge}
                            className="flex items-center gap-2 text-blue-600 text-sm font-medium hover:text-blue-700"
                        >
                            <Plus className="h-4 w-4" />
                            Add Trust Badge
                        </button>
                    </div>
                </Section>

                {/* Lead Form */}
                <Section title="Lead Form Integration" icon={MessageSquare}>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-700">
                                Enable Lead Form on Brand Page:
                            </label>
                            <button
                                onClick={() =>
                                    updateBrand({
                                        leadFormEnabled: !brand.leadFormEnabled,
                                    })
                                }
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
                                    brand.leadFormEnabled
                                        ? "bg-green-100 text-green-700"
                                        : "bg-gray-100 text-gray-600"
                                }`}
                            >
                                {brand.leadFormEnabled ? (
                                    <>
                                        <Eye className="h-4 w-4" /> Enabled
                                    </>
                                ) : (
                                    <>
                                        <EyeOff className="h-4 w-4" /> Disabled
                                    </>
                                )}
                            </button>
                        </div>
                        {brand.leadFormEnabled && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Lead Form Source Label
                                </label>
                                <input
                                    type="text"
                                    value={brand.leadFormSource || ""}
                                    onChange={(e) =>
                                        updateBrand({ leadFormSource: e.target.value })
                                    }
                                    placeholder="Samsung Brand Page"
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-gray-400 mt-1">
                                    This label appears in the Admin Leads dashboard to identify which brand page the lead came from.
                                </p>
                            </div>
                        )}
                    </div>
                </Section>
            </div>

            {/* Sticky Save Button */}
            <div className="sticky bottom-6 mt-8 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-600 transition-all shadow-xl disabled:opacity-50"
                >
                    {saving ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Save className="h-5 w-5" />
                    )}
                    Save All Changes
                </button>
            </div>
        </div>
    )
}
