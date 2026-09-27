"use client"

import { useState, useEffect } from "react"
import { stores } from "@/lib/store-data"
import { analytics } from "@/lib/analytics"
import { Truck, MapPin, CheckCircle, XCircle, Calendar } from "lucide-react"

export default function DeliveryEstimator() {
    const [pincode, setPincode] = useState("")
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{
        deliverable: boolean
        dateRange?: string
        message: string
    } | null>(null)
    const [touched, setTouched] = useState(false)

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("user_pincode")
        if (stored && stored.length === 6) {
            setPincode(stored)
            checkDelivery(stored)
        }
    }, [])

    const formatDate = (daysToAdd: number) => {
        const date = new Date()
        date.setDate(date.getDate() + daysToAdd)
        return date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })
    }

    const checkDelivery = async (pinOverride?: string) => {
        const pinToCheck = pinOverride || pincode
        if (!pinToCheck || pinToCheck.length !== 6) {
            if (touched) setResult({ deliverable: false, message: "Please enter a valid 6-digit pincode." })
            return
        }

        setLoading(true)
        setResult(null)
        setTouched(true)

        // Persist
        localStorage.setItem("user_pincode", pinToCheck)

        try {
            // 1. Fetch Rules
            const res = await fetch('/api/blocked-pincodes')
            if (!res.ok) throw new Error("Failed to fetch delivery rules")

            const data = await res.json()
            const { blockedPincodes, allowedPincodes, mode } = data

            const isBlocked = (blockedPincodes || []).some((p: any) => p.pincode === pinToCheck)
            const isAllowed = (allowedPincodes || []).some((p: any) => p.pincode === pinToCheck)

            let canDeliver = true

            if (mode === 'blocked' && isBlocked) canDeliver = false
            if (mode === 'allowed' && !isAllowed) canDeliver = false
            if (mode === 'both') {
                if (isBlocked || !isAllowed) canDeliver = false
            }

            if (!canDeliver) {
                setResult({ deliverable: false, message: "Sorry, we do not deliver to this pincode." })
                analytics.checkPincode(pinToCheck, false, "delivery_estimator")
                setLoading(false)
                return
            }

            // 2. Estimate Days based on Store Proximity
            const storePincodes = stores.map(s => {
                const match = (s.address || "").match(/\b\d{6}\b/) || (s.region || "").match(/\b\d{6}\b/)
                return match ? match[0] : ""
            }).filter(Boolean)

            let isNearby = false
            if (storePincodes.includes(pinToCheck)) {
                isNearby = true
            } else {
                const prefix = pinToCheck.substring(0, 3)
                if (storePincodes.some(p => p.startsWith(prefix))) isNearby = true
            }

            // 3. Format Delivery Date
            let dateRangeStr = ""
            if (isNearby) {
                // 2-5 days
                dateRangeStr = `${formatDate(2)} - ${formatDate(5)}`
            } else {
                // 6-7 days
                dateRangeStr = `${formatDate(6)} - ${formatDate(7)}`
            }

            setResult({
                deliverable: true,
                dateRange: dateRangeStr,
                message: isNearby ? "Fast Delivery Available" : "Standard Delivery"
            })
            analytics.checkPincode(pinToCheck, true, "delivery_estimator")

        } catch (e) {
            console.error(e)
            // Fallback
            setResult({
                deliverable: true,
                dateRange: `${formatDate(3)} - ${formatDate(7)}`,
                message: "Available for delivery"
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mb-6 p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-50 p-1.5 rounded-full">
                        <Truck className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-bold text-gray-800 text-sm tracking-tight">Delivery Options</span>
                </div>
            </div>

            <div className="flex gap-2">
                <div className="relative flex-grow">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        onKeyDown={(e) => e.key === 'Enter' && checkDelivery()}
                        placeholder="Enter Pincode"
                        className="w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-transparent focus:bg-white focus:border-blue-500 rounded-lg text-sm transition-all outline-none font-medium placeholder:text-gray-400"
                    />
                </div>
                <button
                    onClick={() => checkDelivery()}
                    disabled={loading || pincode.length !== 6}
                    className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm"
                >
                    {loading ? (
                        <span className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        </span>
                    ) : 'Check'}
                </button>
            </div>

            {result && (
                <div className={`mt-4 pt-4 border-t border-dashed border-gray-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300`}>
                    <div className={`mt-0.5 p-1 rounded-full ${result.deliverable ? 'bg-green-100' : 'bg-red-100'}`}>
                        {result.deliverable ? <CheckCircle className="h-4 w-4 text-green-700" /> : <XCircle className="h-4 w-4 text-red-700" />}
                    </div>
                    <div className="flex-1">
                        {result.deliverable ? (
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
                                    {result.message}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Get it by <span className="font-bold text-green-700">{result.dateRange}</span></span>
                                </div>
                            </div>
                        ) : (
                            <p className="font-medium text-red-600 text-sm mt-0.5">{result.message}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
