"use client"

import { useState, useEffect } from "react"

export default function AboutUs() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <div className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="md:order-2">
            <img
              src="https://placehold.co/600x400/003087/FFFFFF?text=About+Us"
              alt="About Sara Mobiles and Electronics "
              className="rounded-lg shadow-lg"
            />
          </div>

          <div
            className="md:order-1"
            style={{
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
              transitionDelay: "0.2s",
            }}
          >
            <h2 className="text-3xl font-bold mb-6">Our Story</h2>
            <p className="text-gray-600 mb-6">
              Sara Mobiles and Electronics  was founded in 2010 with a simple mission: to provide high-quality products at affordable prices.
              We started as a small local store and have grown into a leading online retailer.
            </p>
            <p className="text-gray-600 mb-6">
              We are committed to providing exceptional customer service and a seamless shopping experience. Our team
              works tirelessly to curate the best products and ensure your satisfaction.
            </p>
            <p className="text-gray-600">
              Thank you for choosing Sara Mobiles and Electronics . We appreciate your support and look forward to serving you for many years
              to come.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
