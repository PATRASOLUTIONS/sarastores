"use client"

import { useState, useEffect } from "react"

export default function AboutSection() {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setIsLoaded(true)
  }, [])

  return (
    <div className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div
            className="order-2 md:order-1"
            style={{
              opacity: isLoaded ? 1 : 0,
              transform: isLoaded ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
              transitionDelay: "0.2s",
            }}
          >
            <h2 className="text-3xl font-bold mb-6">Our Story</h2>
            <p className="text-gray-600 mb-6">
              Founded in 2010, Sara Mobiles and Electronics  began with a simple mission: to make online shopping accessible, affordable, and
              enjoyable for everyone. What started as a small operation has grown into a trusted e-commerce destination
              serving customers worldwide.
            </p>
            <p className="text-gray-600 mb-6">
              Our commitment to quality, customer satisfaction, and innovation has remained unwavering throughout our
              journey. We carefully select each product in our inventory to ensure it meets our high standards.
            </p>
            <p className="text-gray-600 mb-6">
              As we continue to grow, we remain dedicated to our core values: integrity, excellence, and
              customer-centricity. We believe in building lasting relationships with our customers based on trust and
              exceptional service.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-blue-600 font-bold text-xl mb-2">Our Mission</div>
                <p className="text-gray-600">
                  To provide high-quality products at competitive prices with exceptional customer service.
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <div className="text-blue-600 font-bold text-xl mb-2">Our Vision</div>
                <p className="text-gray-600">
                  To become the most trusted and preferred online shopping destination globally.
                </p>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <img
              src="https://placehold.co/600x400/003087/FFFFFF?text=Our+Story"
              alt="About Sara Mobiles and Electronics "
              className="rounded-lg shadow-lg w-full h-auto"
              style={{
                opacity: isLoaded ? 1 : 0,
                transform: isLoaded ? "translateY(0)" : "translateY(20px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
