"use client"

import useSWR from "swr"
import { razorpayOffersSchema, type LiveRazorpayOffer } from "@/lib/razorpay-offers"

const EMPTY_OFFERS: LiveRazorpayOffer[] = []

async function fetchOffers(url: string) {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("Razorpay offers could not be loaded")
  return razorpayOffersSchema.parse(await response.json()).items
}

export function useRazorpayOffers() {
  const { data, error, isLoading, mutate } = useSWR("/api/razorpay/offers", fetchOffers, { shouldRetryOnError: false })
  return { offers: data || EMPTY_OFFERS, error, isLoading, retry: () => void mutate() }
}
