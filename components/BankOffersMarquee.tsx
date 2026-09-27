"use client"

import React, { useState, useEffect } from 'react'
import { RazorpayOffer, BANK_COLORS, getBorderColor } from '@/types/razorpay'

interface BankOffersMarqueeProps {
  className?: string
}

export default function BankOffersMarquee({ className = '' }: BankOffersMarqueeProps) {
  const [offers, setOffers] = useState<RazorpayOffer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOffers()
  }, [])

  const fetchOffers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/razorpay/offers')
      
      if (!response.ok) {
        throw new Error('Failed to fetch offers')
      }

      const data = await response.json()
      setOffers(data.items || [])
      setError(null)
    } catch (err) {
      console.error('Error fetching bank offers:', err)
      setError('Unable to load offers')
    } finally {
      setIsLoading(false)
    }
  }

  const formatOfferText = (offer: RazorpayOffer): { title: string; subtitle: string } => {
    let title = ''
    let subtitle = offer.description

    if (offer.discount_percentage) {
      title = `${offer.discount_percentage}% ${offer.type === 'instant' ? 'Instant Discount' : 'Cashback'}`
      if (offer.max_discount) {
        subtitle = `Up to ₹${offer.max_discount.toLocaleString('en-IN')} ${offer.min_amount ? `on orders above ₹${offer.min_amount.toLocaleString('en-IN')}` : ''}`
      }
    } else if (offer.discount_amount) {
      title = `₹${offer.discount_amount.toLocaleString('en-IN')} Off`
      if (offer.min_amount) {
        subtitle = `On orders above ₹${offer.min_amount.toLocaleString('en-IN')}`
      }
    } else if (offer.type === 'emi') {
      title = 'No Cost EMI'
      subtitle = offer.description || 'Available on select cards'
    } else {
      title = offer.name
    }

    return { title, subtitle }
  }

  const getCardColors = (bank: string) => {
    return BANK_COLORS[bank] || BANK_COLORS['BANK']
  }

  if (isLoading) {
    return (
      <div className={`mb-6 ${className}`}>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
          </svg>
          Bank Offers
        </h3>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[280px] h-20 bg-gray-100 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error || offers.length === 0) {
    return null
  }

  // Filter only active offers
  const activeOffers = offers.filter(offer => offer.active)

  if (activeOffers.length === 0) {
    return null
  }

  return (
    <div className={`mb-6 overflow-hidden ${className}`}>
      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
          <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
        </svg>
        Bank Offers
        <span className="text-xs text-gray-500 font-normal">({activeOffers.length} available)</span>
      </h3>
      <div className="relative">
        <div className="marquee-container">
          <div className="marquee-content">
            {/* First set of offers */}
            <div className="flex gap-3">
              {activeOffers.map((offer) => {
                const { title, subtitle } = formatOfferText(offer)
                const colors = getCardColors(offer.bank)
                const borderColor = getBorderColor(offer.bank)

                return (
                  <div
                    key={offer.id}
                    className={`bank-offer-card bg-gradient-to-br ${colors.from} ${colors.to} border ${borderColor} rounded-lg p-3 min-w-[280px] shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`${colors.badge} text-white px-2 py-1 rounded text-xs font-bold`}>
                        {offer.bank}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{title}</p>
                        <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Duplicate set for seamless loop */}
            <div className="flex gap-3">
              {activeOffers.map((offer) => {
                const { title, subtitle } = formatOfferText(offer)
                const colors = getCardColors(offer.bank)
                const borderColor = getBorderColor(offer.bank)

                return (
                  <div
                    key={`${offer.id}-duplicate`}
                    className={`bank-offer-card bg-gradient-to-br ${colors.from} ${colors.to} border ${borderColor} rounded-lg p-3 min-w-[280px] shadow-sm hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`${colors.badge} text-white px-2 py-1 rounded text-xs font-bold`}>
                        {offer.bank}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{title}</p>
                        <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
