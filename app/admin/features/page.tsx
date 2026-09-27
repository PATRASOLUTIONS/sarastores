"use client"


import { apiFetch } from "@/lib/api-client"
import { useState, useEffect } from "react"
import { Plus, Trash2, Edit, Save, X, Truck, ShieldCheck, Clock, CreditCard, RefreshCcw, Award, Star, Zap, Headphones, Gift } from "lucide-react"
import { toast } from "react-hot-toast"
import * as LucideIcons from "lucide-react"

// Dynamic icon renderer
const IconRenderer = ({ name, className }: { name: string, className?: string }) => {
    const Icon = (LucideIcons as any)[name] || LucideIcons.HelpCircle
    return <Icon className={className} />
}

interface Feature {
    id: string
    title: string
    description: string
    icon: string
    color: string
    isActive: boolean
}

const COMMON_ICONS = [
    "Truck", "ShieldCheck", "Clock", "CreditCard", "RefreshCcw",
    "Award", "Star", "Zap", "Headphones", "Gift", "Package", "BadgeCheck"
]

const COLORS = [
    { name: "Blue", value: "blue", class: "bg-blue-100 text-blue-600 border-blue-200" },
    { name: "Green", value: "green", class: "bg-green-100 text-green-600 border-green-200" },
    { name: "Purple", value: "purple", class: "bg-purple-100 text-purple-600 border-purple-200" },
    { name: "Red", value: "red", class: "bg-red-100 text-red-600 border-red-200" },
    { name: "Yellow", value: "yellow", class: "bg-yellow-100 text-yellow-600 border-yellow-200" },
    { name: "Gray", value: "gray", class: "bg-gray-100 text-gray-600 border-gray-200" },
]

export default function AdminFeaturesPage() {
    const [features, setFeatures] = useState<Feature[]>([])
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState<string | null>(null)
    const [formData, setFormData] = useState<Partial<Feature>>({
        title: "",
        description: "",
        icon: "Truck",
        color: "blue",
        isActive: true
    })

    useEffect(() => {
        fetchFeatures()
    }, [])

    const fetchFeatures = async () => {
        try {
            const res = await apiFetch("/api/admin/features")
            if (res.ok) {
                setFeatures(await res.json())
            }
        } catch (error) {
            toast.error("Failed to load features")
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            if (isEditing) {
                const res = await apiFetch("/api/admin/features", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...formData, id: isEditing }),
                })
                if (!res.ok) throw new Error("Failed to update")
                toast.success("Feature updated")
            } else {
                const res = await apiFetch("/api/admin/features", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                })
                if (!res.ok) throw new Error("Failed to create")
                toast.success("Feature created")
            }
            resetForm()
            fetchFeatures()
        } catch (error) {
            toast.error("Operation failed")
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return
        try {
            const res = await apiFetch(`/api/admin/features?id=${id}`, { method: "DELETE" })
            if (res.ok) {
                toast.success("Feature deleted")
                setFeatures(features.filter(f => f.id !== id))
            }
        } catch (error) {
            toast.error("Failed to delete")
        }
    }

    const handleEdit = (feature: Feature) => {
        setIsEditing(feature.id)
        setFormData(feature)
    }

    const resetForm = () => {
        setIsEditing(null)
        setFormData({
            title: "",
            description: "",
            icon: "Truck",
            color: "blue",
            isActive: true
        })
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Manage Site Features</h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Section */}
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                        <h2 className="text-lg font-semibold mb-4">{isEditing ? "Edit Feature" : "Add New Feature"}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="e.g., Free Delivery"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="On orders above ₹500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Icon</label>
                                <div className="grid grid-cols-4 gap-2 border rounded-lg p-2 h-32 overflow-y-auto">
                                    {COMMON_ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, icon })}
                                            className={`flex flex-col items-center justify-center p-2 rounded hover:bg-gray-50 ${formData.icon === icon ? "bg-blue-50 border-blue-200 ring-1 ring-blue-400" : ""}`}
                                        >
                                            <IconRenderer name={icon} className="h-5 w-5 mb-1" />
                                            <span className="text-[10px] truncate w-full text-center">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Color Theme</label>
                                <div className="flex gap-2">
                                    {COLORS.map(c => (
                                        <button
                                            key={c.name}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, color: c.value })}
                                            className={`w-8 h-8 rounded-full border-2 ${c.class.split(' ')[0]} ${formData.color === c.value ? "ring-2 ring-offset-1 ring-black border-transparent" : "border-gray-200"}`}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                                >
                                    {isEditing ? "Update" : "Add Feature"}
                                </button>
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2">
                    {loading ? (
                        <div className="flex justify-center p-8">Loading...</div>
                    ) : features.length === 0 ? (
                        <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-xl">No features found. Add one!</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {features.map(feature => {
                                const theme = COLORS.find(c => c.value === feature.color) || COLORS[0]
                                return (
                                    <div key={feature.id} className={`flex items-start p-4 rounded-xl border ${theme.class} bg-opacity-30 border-opacity-50`}>
                                        <div className={`p-2 rounded-lg bg-white bg-opacity-60 mr-4`}>
                                            <IconRenderer name={feature.icon} className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                                            {feature.description && <p className="text-sm text-gray-600">{feature.description}</p>}
                                        </div>
                                        <div className="flex gap-2 ml-2">
                                            <button onClick={() => handleEdit(feature)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded">
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleDelete(feature.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
