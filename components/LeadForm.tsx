"use client"

import { useState, useEffect } from "react"
import { useSubmitLock } from "@/hooks/useSubmitLock"
import { Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import toast from "react-hot-toast"

interface LeadFormSettings {
    fields: {
        name: { enabled: boolean; required: boolean }
        phone: { enabled: boolean; required: boolean }
        pincode: { enabled: boolean; required: boolean }
        email: { enabled: boolean; required: boolean }
        category: { enabled: boolean; required: boolean }
    }
    categories: string[]
    buttonText: string
    successMessage: string
}

interface LeadFormProps {
    source?: string
    className?: string
    variant?: "light" | "dark"
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
}

export default function LeadForm({ source = "Shubham Lucky Draw", className = "", variant = "dark" }: LeadFormProps) {
    const [settings, setSettings] = useState<LeadFormSettings>(defaultSettings)
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        pincode: "",
        email: "",
        category: "",
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const lock = useSubmitLock()
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch("/api/leads/settings")
            const data = await res.json()
            if (data.success && data.settings) {
                setSettings({
                    fields: data.settings.fields || defaultSettings.fields,
                    categories: data.settings.categories || defaultSettings.categories,
                    buttonText: data.settings.buttonText || defaultSettings.buttonText,
                    successMessage: data.settings.successMessage || defaultSettings.successMessage,
                })
            }
        } catch {
            // Use defaults silently
        }
    }

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {}
        const f = settings.fields

        if (f.name.enabled && f.name.required && (!formData.name || formData.name.trim().length < 3)) {
            newErrors.name = "Name is required (minimum 3 characters)"
        }

        if (f.phone.enabled && f.phone.required) {
            const cleanPhone = formData.phone.replace(/\D/g, "")
            if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
                newErrors.phone = "Valid 10-digit phone number is required"
            }
        }

        if (f.pincode.enabled && f.pincode.required) {
            if (!formData.pincode || !/^\d{6}$/.test(formData.pincode.trim())) {
                newErrors.pincode = "Valid 6-digit pincode is required"
            }
        }

        if (f.email.enabled && f.email.required && (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()))) {
            newErrors.email = "Valid email is required"
        }

        if (f.email.enabled && !f.email.required && formData.email && formData.email.trim()) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
                newErrors.email = "Invalid email format"
            }
        }

        if (f.category.enabled && f.category.required && !formData.category) {
            newErrors.category = "Please select a category"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return
        if (!lock.acquire()) return

        setIsSubmitting(true)
        try {
            const res = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, source }),
            })
            const data = await res.json()

            if (data.success) {
                setShowSuccess(true)
                setFormData({ name: "", phone: "", pincode: "", email: "", category: "" })
                toast.success(settings.successMessage)
                setTimeout(() => setShowSuccess(false), 5000)
            } else {
                toast.error(data.error || "Something went wrong")
            }
        } catch {
            toast.error("Failed to submit. Please try again.")
        } finally {
            lock.release()
            setIsSubmitting(false)
        }
    }

    const isDark = variant === "dark"
    const inputClasses = isDark
        ? "w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 focus:border-yellow-400/50 transition-all"
        : "w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
    const labelClasses = isDark ? "text-white/80 text-sm font-medium mb-1 block" : "text-gray-700 text-sm font-medium mb-1 block"
    const errorClasses = "text-red-400 text-xs mt-1 flex items-center gap-1"

    // Success popup
    if (showSuccess) {
        return (
            <div className={`${className} text-center py-12`}>
                <div className={`inline-flex flex-col items-center gap-4 p-8 rounded-2xl ${isDark ? "bg-green-500/20 border border-green-400/30" : "bg-green-50 border border-green-200"}`}>
                    <CheckCircle2 className={`w-16 h-16 ${isDark ? "text-green-400" : "text-green-500"}`} />
                    <h3 className={`text-xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>Submitted Successfully!</h3>
                    <p className={`text-sm max-w-sm ${isDark ? "text-white/70" : "text-gray-600"}`}>
                        {settings.successMessage}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className={className}>
            <div className="space-y-4">
                {/* Name */}
                {settings.fields.name.enabled && (
                    <div>
                        <label htmlFor="lead-name" className={labelClasses}>
                            Name {settings.fields.name.required && <span className="text-red-400">*</span>}
                        </label>
                        <input
                            id="lead-name"
                            type="text"
                            placeholder="Enter your full name"
                            className={inputClasses}
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                        {errors.name && (
                            <p className={errorClasses}>
                                <AlertCircle className="w-3 h-3" /> {errors.name}
                            </p>
                        )}
                    </div>
                )}

                {/* Phone */}
                {settings.fields.phone.enabled && (
                    <div>
                        <label htmlFor="lead-phone" className={labelClasses}>
                            Phone Number {settings.fields.phone.required && <span className="text-red-400">*</span>}
                        </label>
                        <input
                            id="lead-phone"
                            type="tel"
                            placeholder="10-digit mobile number"
                            maxLength={10}
                            className={inputClasses}
                            value={formData.phone}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "")
                                setFormData(prev => ({ ...prev, phone: val }))
                            }}
                        />
                        {errors.phone && (
                            <p className={errorClasses}>
                                <AlertCircle className="w-3 h-3" /> {errors.phone}
                            </p>
                        )}
                    </div>
                )}

                {/* Pincode */}
                {settings.fields.pincode.enabled && (
                    <div>
                        <label htmlFor="lead-pincode" className={labelClasses}>
                            Pincode {settings.fields.pincode.required && <span className="text-red-400">*</span>}
                        </label>
                        <input
                            id="lead-pincode"
                            type="text"
                            placeholder="6-digit pincode"
                            maxLength={6}
                            className={inputClasses}
                            value={formData.pincode}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "")
                                setFormData(prev => ({ ...prev, pincode: val }))
                            }}
                        />
                        {errors.pincode && (
                            <p className={errorClasses}>
                                <AlertCircle className="w-3 h-3" /> {errors.pincode}
                            </p>
                        )}
                    </div>
                )}

                {/* Email */}
                {settings.fields.email.enabled && (
                    <div>
                        <label htmlFor="lead-email" className={labelClasses}>
                            Email ID {settings.fields.email.required ? <span className="text-red-400">*</span> : <span className={isDark ? "text-white/40" : "text-gray-400"}>(Optional)</span>}
                        </label>
                        <input
                            id="lead-email"
                            type="email"
                            placeholder="your@email.com"
                            className={inputClasses}
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        />
                        {errors.email && (
                            <p className={errorClasses}>
                                <AlertCircle className="w-3 h-3" /> {errors.email}
                            </p>
                        )}
                    </div>
                )}

                {/* Category */}
                {settings.fields.category.enabled && (
                    <div>
                        <label htmlFor="lead-category" className={labelClasses}>
                            Category {settings.fields.category.required && <span className="text-red-400">*</span>}
                        </label>
                        <select
                            id="lead-category"
                            className={inputClasses}
                            value={formData.category}
                            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        >
                            <option value="">Select a category</option>
                            {settings.categories.map((cat) => (
                                <option key={cat} value={cat} className="text-gray-900 bg-white">
                                    {cat}
                                </option>
                            ))}
                        </select>
                        {errors.category && (
                            <p className={errorClasses}>
                                <AlertCircle className="w-3 h-3" /> {errors.category}
                            </p>
                        )}
                    </div>
                )}
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full mt-6 px-6 py-4 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg ${
                    isDark
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600 shadow-lg shadow-yellow-500/30 disabled:opacity-50"
                        : "bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30 disabled:opacity-50"
                }`}
            >
                {isSubmitting ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Submitting...
                    </>
                ) : (
                    <>
                        <Send className="w-5 h-5" />
                        {settings.buttonText}
                    </>
                )}
            </button>
        </form>
    )
}
