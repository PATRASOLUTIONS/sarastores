"use client"

import { useEffect, useState } from "react"
import * as LucideIcons from "lucide-react"

interface Feature {
    id: string
    title: string
    description: string
    icon: string
    color: string
}

// Map color names to Tailwind classes
const COLOR_MAP: Record<string, string> = {
    blue: "bg-blue-50 border-blue-100 text-blue-600",
    green: "bg-green-50 border-green-100 text-green-600",
    purple: "bg-purple-50 border-purple-100 text-purple-600",
    red: "bg-red-50 border-red-100 text-red-600",
    yellow: "bg-yellow-50 border-yellow-100 text-yellow-600",
    gray: "bg-gray-50 border-gray-100 text-gray-600",
}

export default function SiteFeatures() {
    const [features, setFeatures] = useState<Feature[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchFeatures = async () => {
            try {
                const res = await fetch("/api/admin/features")
                if (res.ok) {
                    const data = await res.json()
                    setFeatures(data)
                }
            } catch (err) {
                console.error("Failed to load site features")
            } finally {
                setLoading(false)
            }
        }

        fetchFeatures()
    }, [])

    if (loading) return <div className="animate-pulse h-20 bg-gray-50 rounded-lg w-full mb-6"></div>
    if (features.length === 0) return null

    return (
        <div className={`grid grid-cols-2 md:grid-cols-${Math.min(features.length, 4)} gap-3 mb-6`}>
            {features.map((feature) => {
                const Icon = (LucideIcons as any)[feature.icon] || LucideIcons.HelpCircle
                const colorClass = COLOR_MAP[feature.color] || COLOR_MAP.blue

                return (
                    <div
                        key={feature.id}
                        className={`flex flex-col items-center p-3 rounded-lg border ${colorClass} text-center transition-transform hover:scale-105`}
                    >
                        <Icon className="h-6 w-6 mb-1" />
                        <span className="text-xs font-semibold text-gray-700">{feature.title}</span>
                        {feature.description && <span className="text-[10px] text-gray-500 mt-0.5 hidden md:block">{feature.description}</span>}
                    </div>
                )
            })}
        </div>
    )
}
