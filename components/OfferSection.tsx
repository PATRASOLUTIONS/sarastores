"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Tag, Copy } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "react-hot-toast"
import { Reveal } from '@/components/motion/AnimationComponents'

interface OfferProduct {
  id: string
  name: string
  description: string
  originalPrice: number
  offerPrice: number
  discount: number
  image: string
  badge: string
  stock: number
  active: boolean
}

export default function OfferSection() {
  const [offers, setOffers] = useState<OfferProduct[]>([])
  const [loading, setLoading] = useState(true)
  const { user, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    fetchOffers()
  }, [])

  const fetchOffers = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/offers")

      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.offers)) {
          // Filter only active offers
          const activeOffers = data.offers.filter((offer: OfferProduct) => offer.active)
          setOffers(activeOffers.slice(0, 6)) // Show max 6 offers
        }
      }
    } catch (error) {
      console.error("Error fetching offers:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Coupon code copied")
    } catch (err) {
      toast.error("Failed to copy code")
    }
  }

  if (loading) {
    return (
      <section className="py-12 bg-gradient-to-br from-brand-primary-subtle to-white rounded-2xl">
        <div className="section-container">
          <div className="text-center mb-8">
            <div className="h-6 bg-gray-200 rounded w-56 mx-auto mb-3 animate-pulse"></div>
            <div className="h-3 bg-gray-200 rounded w-80 mx-auto animate-pulse"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden animate-pulse">
                <div className="h-40 bg-gray-200"></div>
                <div className="p-4">
                  <div className="h-3 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-full mb-3"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (offers.length === 0) {
    return null // Don't show section if no offers
  }

  return (
    <Reveal>
    <section className="pt-6 pb-3 bg-transparent" aria-label="Special offers">
      <div className="section-container">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {offers.map((offer, idx) => (
            <Reveal key={offer.id} delay={idx * 0.08} direction="up">
            <div
              className="rounded-xl overflow-hidden shadow-md relative"
            >
              <div className={`flex flex-col md:flex-row items-stretch h-auto md:h-48`}>
                {/* Left content (60%) */}
                <div className={`w-full md:w-7/12 p-3 flex flex-col justify-center relative order-last md:order-none ${idx % 2 === 0 ? 'bg-gradient-to-br from-brand-primary to-brand-primary-hover text-white' : 'bg-brand-primary-subtle text-gray-900'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${idx % 2 === 0 ? 'bg-white/15' : 'bg-white'}`}>
                        {/* small icon */}
                        <Tag className={`${idx % 2 === 0 ? 'text-white' : 'text-brand-accent'} w-4 h-4`} />
                      </div>
                      <div className="text-xs uppercase tracking-wider opacity-90 font-medium">
                        {offer.badge || offer.name.split(' ')[0]}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <h3 className={`text-2xl font-bold leading-tight ${idx % 2 === 0 ? 'text-white' : 'text-gray-900'}`}>
                      UP to {offer.discount}% OFF
                    </h3>

                    {/* If this is a coupon-only offer (no prices), show a coupon pill + copy button */}
                    {offer.originalPrice === 0 && offer.offerPrice === 0 ? (
                      <div className={`mt-2 flex items-center gap-3 ${idx % 2 === 0 ? 'text-gray-200' : 'text-gray-700'}`}>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase opacity-80">Coupon Code</span>
                          <div className="mt-1 inline-flex items-center bg-white/10 px-3 py-1 rounded-full font-mono text-sm tracking-wide">
                            <span className="mr-3">{offer.name}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(offer.name)}
                              className={`ml-1 inline-flex items-center justify-center p-1 rounded-full ${idx % 2 === 0 ? 'bg-white/10 hover:bg-white/20' : 'bg-white/5 hover:bg-white/10'}`}
                              aria-label="Copy coupon code"
                            >
                              <Copy className={`w-4 h-4 ${idx % 2 === 0 ? 'text-white' : 'text-yellow-600'}`} />
                            </button>
                          </div>
                        </div>

                        
                      </div>
                    ) : (
                      <p className={`mt-1 text-sm ${idx % 2 === 0 ? 'text-gray-300' : 'text-gray-600'} max-w-md`}>{offer.name}</p>
                    )}
                  </div>

                  
                </div>

                {/* Right image (40%) - stacks above on small screens */}
                <div className="w-full md:w-5/12 flex items-center justify-center p-2 order-first md:order-none">
                  <div className="relative w-full h-36 md:h-48 rounded-lg overflow-hidden shadow bg-white">
                    <Image
                      src={offer.image || '/placeholder.svg'}
                      alt={offer.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 40vw"
                      quality={75}
                    />
                  </div>
                </div>
              </div>
            </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
    </Reveal>
  )
}
