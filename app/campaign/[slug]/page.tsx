"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CategoryProductCard from "@/components/CategoryProductCard"
import { Loader2 } from "lucide-react"

export default function CampaignPage() {
  const params = useParams()
  const slug = params?.slug as string
  
  const [campaign, setCampaign] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    
    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaign-pages/${slug}`, {
          // Disable caching to assure real-time stock/price data is retrieved
          cache: "no-store", 
        })
        const data = await res.json()
        
        if (data.success && data.campaign) {
          setCampaign(data.campaign)
        } else {
          setError(data.error || "Campaign not found")
        }
      } catch (err) {
        setError("Failed to load campaign page.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchCampaign()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Campaign Not Found</h2>
          <p className="text-gray-500 mb-8 max-w-md">The promotional page you are looking for does not exist or has expired.</p>
          <a href="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">
            Return to Homepage
          </a>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      
      <main className="flex-1 w-full relative">
        {/* Full-width Hero Banner */}
        {campaign.banner && (
           <div className="w-full relative overflow-hidden bg-gray-100 flex items-center justify-center min-h-[160px] md:min-h-[300px] border-b border-gray-100 shadow-sm">
             <img 
               src={campaign.banner} 
               alt={campaign.name}
               className="w-full h-auto object-cover max-h-[500px]"
             />
           </div>
        )}

        {/* Campaign Title (Fallback if no banner, or just for structure) */}
        {!campaign.banner && (
          <div className="w-full py-16 bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center px-4">
            <h1 className="text-3xl md:text-5xl font-bold">{campaign.name}</h1>
          </div>
        )}

        {/* Curation Grid */}
        <section className="container mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
            <span className="text-sm text-gray-500 font-medium">{campaign.products?.length || 0} Items</span>
          </div>

          {campaign.products && campaign.products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
              {campaign.products.map((product: any) => (
                <CategoryProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-700 mb-1">Coming Soon</h3>
              <p className="text-gray-500 text-sm">Products are currently being curated for {campaign.name}. Check back shortly!</p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
