"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"

export interface Offer {
  id: string
  /** Records in the `offers` collection use `name`; `title` only appears on newer rows. */
  title?: string
  name?: string
  description: string
  discountType: "percentage" | "fixed" | "buyOneGetOne"
  discountValue: number
  code: string
  startDate: string
  endDate: string
  minPurchase?: number
  maxDiscount?: number
  applicableProducts?: string[]
  applicableCategories?: string[]
  image?: string
  isActive: boolean
}

export function useOffers() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useAuth()

  const fetchOffers = useCallback(async () => {
    setIsLoading(true)
    try {
      const url = user ? `/api/offers?userId=${user.id}` : "/api/offers"
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch offers")
      }
      const data = await response.json()
      // The route replies { success, offers }, older callers expected a bare array.
      setOffers(Array.isArray(data) ? data : data?.offers || [])
    } catch (error) {
      console.error("Error fetching offers:", error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  return {
    offers,
    isLoading,
    refreshOffers: fetchOffers,
  }
}
