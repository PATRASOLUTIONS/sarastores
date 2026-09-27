"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"
import Link from "next/link"
import type { JSX } from "react"

export interface BannerCard {
  id: string
  title: string
  description: string
  icon: string
  link: string
  linkText: string
}

interface BannerProps {
  initialCards?: BannerCard[]
  isLoading?: boolean
}

export default function Banner({ initialCards, isLoading = false }: BannerProps) {
  const [cards, setCards] = useState<BannerCard[]>(initialCards || [])
  const [loading, setLoading] = useState(isLoading)

  useEffect(() => {
    if (!initialCards) {
      const fetchCards = async () => {
        try {
          const response = await fetch("/api/split-cards")
          if (!response.ok) {
            console.error("Failed to fetch cards, using defaults")
            setCards(getDefaultCards())
          } else {
            const data = await response.json()
            if (Array.isArray(data) && data.length > 0) {
              setCards(data)
            } else {
              setCards(getDefaultCards())
            }
          }
        } catch (error) {
          console.error("Error fetching banner cards:", error)
          setCards(getDefaultCards())
        } finally {
          setLoading(false)
        }
      }

      fetchCards()
    } else {
      setCards(initialCards.length > 0 ? initialCards : getDefaultCards())
      setLoading(false)
    }
  }, [initialCards])

  // Default cards function
  const getDefaultCards = () => [
    {
      id: "default1",
      title: "Fast Shipping",
      description: "Free delivery for all orders over ₹500",
      icon: "truck",
      link: "/shipping",
      linkText: "Learn More",
    },
    {
      id: "default2",
      title: "Quality Assured",
      description: "Verified & tested products",
      icon: "shield-check",
      link: "/about",
      linkText: "Learn More",
    },
    {
      id: "default3",
      title: "Secure Payment",
      description: "Multiple secure payment options",
      icon: "shield",
      link: "/payment",
      linkText: "Payment Options",
    },
    {
      id: "default4",
      title: "10:00 AM to 6:00 PM",
      description: "Get help whenever you need it",
      icon: "headphones",
      link: "/support",
      linkText: "Contact Us",
    },
  ]

  if (loading) {
    return (
      <section className="py-8 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 animate-pulse rounded-lg"></div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Function to render the appropriate icon
  const renderIcon = (iconName: string) => {
    if (!iconName)
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" x2="12" y1="8" y2="16"></line>
          <line x1="8" x2="16" y1="12" y2="12"></line>
        </svg>
      )

    const iconMap: Record<string, JSX.Element> = {
      truck: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M10 17h4V5H2v12h3"></path>
          <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"></path>
          <path d="M14 17h1"></path>
          <circle cx="7.5" cy="17.5" r="2.5"></circle>
          <circle cx="17.5" cy="17.5" r="2.5"></circle>
        </svg>
      ),
      "refresh-ccw": (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M3 2v6h6"></path>
          <path d="M21 12A9 9 0 0 0 6 5.3L3 8"></path>
          <path d="M21 22v-6h-6"></path>
          <path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"></path>
        </svg>
      ),
      shield: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path>
        </svg>
      ),
      headphones: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
        </svg>
      ),
      "credit-card": (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <rect width="20" height="14" x="2" y="5" rx="2"></rect>
          <line x1="2" x2="22" y1="10" y2="10"></line>
        </svg>
      ),
      gift: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <polyline points="20 12 20 22 4 22 4 12"></polyline>
          <rect width="20" height="5" x="2" y="7"></rect>
          <line x1="12" x2="12" y1="22" y2="7"></line>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>
        </svg>
      ),
      tag: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path>
          <path d="M7 7h.01"></path>
        </svg>
      ),
      star: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
      ),
    }

    return (
      iconMap[iconName] || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" x2="12" y1="8" y2="16"></line>
          <line x1="8" x2="16" y1="12" y2="12"></line>
        </svg>
      )
    )
  }

  // Ensure we have cards to display
  const displayCards = cards.length > 0 ? cards : getDefaultCards()

  return (
    <section className="py-8 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayCards.map((card) => (
            <Card
              key={card.id}
              className="overflow-hidden transition-all duration-300 hover:shadow-lg group"
              style={{ backgroundColor: "#003087" }}
            >
              <CardContent className="p-4 flex flex-col h-full">
                <div className="mb-3">
                  <div className="text-white mb-3">{renderIcon(card.icon)}</div>
                  <h3 className="text-lg font-bold text-white mb-1.5">{card.title}</h3>
                </div>
                <div className="flex-grow">
                  <p className="text-gray-200 text-sm mb-3 leading-relaxed">{card.description}</p>
                </div>
                <Link
                  href={card.link}
                  className="text-white text-sm font-medium flex items-center group-hover:underline mt-auto"
                >
                  {card.linkText}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
