import { NextResponse } from "next/server"

export async function GET() {
  // Sample advertisement data
  const fallbackAdvertisements = [
    {
      id: "fallback-1",
      title: "Summer Sale",
      description: "Get up to 50% off|Free shipping on all orders|Limited time offer",
      image: "/placeholder.svg?height=400&width=600",
      buttonText: "Shop Now",
      buttonLink: "/products",
      bgColor: "bg-maroon-800",
      textColor: "text-white",
      active: true,
      order: 0,
    },
    {
      id: "fallback-2",
      title: "New Arrivals",
      description: "Check out our latest products|Exclusive designs|Premium quality",
      image: "/placeholder.svg?height=400&width=600",
      buttonText: "Explore",
      buttonLink: "/products",
      bgColor: "bg-blue-700",
      textColor: "text-white",
      active: true,
      order: 1,
    },
    {
      id: "fallback-3",
      title: "Special Offer",
      description: "Buy one get one free|On selected items|While supplies last",
      image: "/placeholder.svg?height=400&width=600",
      buttonText: "View Offers",
      buttonLink: "/products",
      bgColor: "bg-green-700",
      textColor: "text-white",
      active: true,
      order: 2,
    },
  ]

  return NextResponse.json(fallbackAdvertisements)
}
