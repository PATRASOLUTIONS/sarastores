"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import {
    Settings,
    Save,
    Plus,
    Trash2,
    ToggleLeft,
    ToggleRight,
    MessageSquare,
    FileText,
    Loader2,
    AlertCircle,
    CheckCircle2,
    ArrowLeft,
    Phone,
} from "lucide-react"
import Link from "next/link"
import toast from "react-hot-toast"

interface FieldConfig {
    enabled: boolean
    required: boolean
}

interface LeadFormSettings {
    fields: {
        name: FieldConfig
        phone: FieldConfig
        pincode: FieldConfig
        email: FieldConfig
        category: FieldConfig
    }
    categories: string[]
    buttonText: string
    successMessage: string
    whatsappTemplate: string
    whatsappNumber: string
}

const defaultSettings: LeadFormSettings = {
    fields: {
        name: { enabled: true, required: true },
        phone: { enabled: true, required: true },
        pincode: { enabled: true, required: true },
        email: { enabled: true, required: false },
        category: { enabled: true, required: true },
    },
    categories: [
        "Smart TV", "LED TV", "OLED TV",
        "Refrigerator", "Washing Machine", "Air Conditioner",
        "Microwave Oven", "Water Purifier",
        "Smartphone", "Laptop", "Tablet",
        "Smart Watch", "Wireless Earbuds", "Headphones",
        "Speaker System", "Soundbar", "Home Theater",
        "Vacuum Cleaner", "Air Purifier", "Other"
    ],
    buttonText: "Submit Entry",
    successMessage: "Thank you for submitting. Our team will contact you shortly.",
    whatsappTemplate: "Hello {name}, thank you for participating in our Lucky Draw!",
    whatsappNumber: "",
}

const FIELD_LABELS: Record<string, string> = {
    name: "Name",
    phone: "Phone Number",
    pincode: "Pincode",
    email: "Email ID",
    category: "Category",
}

export default function LeadSettingsPage() {
    const [settings, setSettings] = useState<LeadFormSettings>(defaultSettings)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [newCategory, setNewCategory] = useState("")

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await apiFetch("/api/leads/settings")
            const data = await res.json()
            if (data.success && data.settings) {
                setSettings({
                    fields: data.settings.fields || defaultSettings.fields,
                    categories: data.settings.categories || defaultSettings.categories,
                    buttonText: data.settings.buttonText || defaultSettings.buttonText,
                    successMessage: data.settings.successMessage || defaultSettings.successMessage,
                    whatsappTemplate: data.settings.whatsappTemplate || defaultSettings.whatsappTemplate,
                    whatsappNumber: data.settings.whatsappNumber || defaultSettings.whatsappNumber,
                })
            }
        } catch {
            toast.error("Failed to load settings")
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await apiFetch("/api/leads/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            })
            const data = await res.json()
            if (data.success) {
                toast.success("Settings saved successfully")
            } else {
                toast.error(data.error || "Failed to save settings")
            }
        } catch {
            toast.error("Failed to save settings")
        } finally {
            setSaving(false)
        }
    }

    const toggleField = (field: string, prop: "enabled" | "required") => {
        setSettings(prev => ({
            ...prev,
            fields: {
                ...prev.fields,
                [field]: {
                    ...prev.fields[field as keyof typeof prev.fields],
                    [prop]: !prev.fields[field as keyof typeof prev.fields][prop],
                },
            },
        }))
    }

    const addCategory = () => {
        if (!newCategory.trim()) return
        if (settings.categories.includes(newCategory.trim())) {
            toast.error("Category already exists")
            return
        }
        setSettings(prev => ({
            ...prev,
            categories: [...prev.categories, newCategory.trim()],
        }))
        setNewCategory("")
    }

    const removeCategory = (index: number) => {
        setSettings(prev => ({
            ...prev,
            categories: prev.categories.filter((_, i) => i !== index),
        }))
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-500">Loading settings...</span>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/leads"
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Settings className="h-6 w-6 text-blue-600" />
                            Lead Form Settings
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">Configure lead form fields, categories, and messages</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Settings
                </button>
            </div>

            {/* Field Configuration */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Form Fields
                </h2>
                <div className="space-y-3">
                    {Object.entries(settings.fields).map(([key, config]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                        >
                            <div>
                                <p className="font-medium text-gray-900">{FIELD_LABELS[key]}</p>
                                <p className="text-xs text-gray-500">
                                    {config.enabled ? "Visible" : "Hidden"} • {config.required ? "Required" : "Optional"}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => toggleField(key, "enabled")}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    {config.enabled ? (
                                        <ToggleRight className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <ToggleLeft className="h-6 w-6 text-gray-300" />
                                    )}
                                    <span className={config.enabled ? "text-green-600" : "text-gray-400"}>
                                        {config.enabled ? "Enabled" : "Disabled"}
                                    </span>
                                </button>
                                {config.enabled && (
                                    <button
                                        onClick={() => toggleField(key, "required")}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                            config.required
                                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                                        }`}
                                    >
                                        {config.required ? "Required" : "Optional"}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Categories */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Category List</h2>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Add new category..."
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={newCategory}
                        onChange={e => setNewCategory(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addCategory()}
                    />
                    <button
                        onClick={addCategory}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Add
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {settings.categories.map((cat, i) => (
                        <span
                            key={i}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm group"
                        >
                            {cat}
                            <button
                                onClick={() => removeCategory(i)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            </div>

            {/* Button & Messages */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <h2 className="text-lg font-semibold text-gray-900">Button & Messages</h2>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Button Text</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={settings.buttonText}
                        onChange={e => setSettings(prev => ({ ...prev, buttonText: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Success Message</label>
                    <textarea
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        value={settings.successMessage}
                        onChange={e => setSettings(prev => ({ ...prev, successMessage: e.target.value }))}
                    />
                </div>
            </div>

            {/* WhatsApp Configuration */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-green-600" />
                    WhatsApp Configuration
                </h2>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Admin WhatsApp Number <span className="text-gray-400">(10 digits, used for wa.me link)</span>
                    </label>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">+91</span>
                        <input
                            type="text"
                            maxLength={10}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Enter 10-digit number"
                            value={settings.whatsappNumber}
                            onChange={e => setSettings(prev => ({ ...prev, whatsappNumber: e.target.value.replace(/\D/g, "") }))}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        WhatsApp Message Template <span className="text-gray-400">(use {"{name}"} as placeholder)</span>
                    </label>
                    <textarea
                        rows={3}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        value={settings.whatsappTemplate}
                        onChange={e => setSettings(prev => ({ ...prev, whatsappTemplate: e.target.value }))}
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Preview: {settings.whatsappTemplate.replace("{name}", "John")}
                    </p>
                </div>
            </div>

            {/* Save Button Bottom */}
            <div className="flex justify-end pb-8">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save All Settings
                </button>
            </div>
        </div>
    )
}
