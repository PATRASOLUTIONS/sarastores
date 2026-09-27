"use client"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function StaticProductAdvertisements() {
  // Default fallback advertisements
  const fallbackAds = [
    {
      id: "fallback-ad-1",
      title: "Premium Smartphones",
      description:
        "Discover our latest collection of premium smartphones with cutting-edge features and sleek designs.",
      image: "https://placehold.co/600x400/3b82f6/ffffff?text=Premium+Smartphones",
      releaseDate: "New Arrivals",
      features: ["5G Connectivity", "Pro Camera System", "All-day Battery", "Water Resistant"],
      bgColor: "from-blue-600 to-blue-800",
      textColor: "text-white",
      buttonColor: "bg-white text-blue-800 hover:bg-blue-50",
      buttonText: "Shop Now",
      link: "/products?category=smartphones",
    },
    {
      id: "fallback-ad-2",
      title: "Smart Home Devices",
      description: "Transform your home with our range of smart devices. Control everything from your phone.",
      image: "https://placehold.co/600x400/10b981/ffffff?text=Smart+Home",
      releaseDate: "Featured Collection",
      features: ["Voice Control", "Energy Efficient", "Easy Setup", "Remote Access"],
      bgColor: "from-emerald-600 to-emerald-800",
      textColor: "text-white",
      buttonColor: "bg-white text-emerald-800 hover:bg-emerald-50",
      buttonText: "Explore",
      link: "/products?category=smart-home",
    },
  ]

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold mb-8 text-center">Featured Products</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {fallbackAds.map((ad) => (
            <div key={ad.id} className={`rounded-xl overflow-hidden shadow-xl`}>
              <div
                className={`bg-gradient-to-r ${ad.bgColor || "from-blue-900 to-indigo-800"} p-6 md:p-8 ${ad.textColor || "text-white"}`}
              >
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="md:w-1/2">
                    <h3 className="text-2xl md:text-3xl font-bold mb-4">{ad.title}</h3>
                    <p className="mb-6 opacity-90">{ad.description}</p>

                    <Link href={ad.link || "/products"}>
                      <button
                        className={`group ${ad.buttonColor || "bg-white text-blue-900 hover:bg-blue-50"} px-6 py-3 rounded-lg font-semibold transition-colors flex items-center`}
                      >
                        {ad.buttonText || "Learn More"}
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </button>
                    </Link>
                  </div>

                  <div className="md:w-1/2 flex items-center justify-center">
                    <img
                      src={ad.image || "/placeholder.svg?height=400&width=600"}
                      alt={ad.title || "Featured product"}
                      className="rounded-lg shadow-lg max-h-48 object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = "/placeholder.svg?height=400&width=600"
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
