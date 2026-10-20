"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import CategoryProductCard from "@/components/CategoryProductCard"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import { publicCampaignPageResponseSchema, type PublicCampaignPage } from "@/lib/campaign-page"

export default function CampaignExperience({ fixedSlug }: { fixedSlug?: string }) {
  const params = useParams()
  const slug = fixedSlug || (typeof params?.slug === "string" ? params.slug : undefined)
  const [campaign, setCampaign] = useState<PublicCampaignPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    setLoading(true)
    setCampaign(null)
    setError(null)
    setMissing(false)

    async function fetchCampaign() {
      try {
        const response = await fetch(`/api/campaign-pages/${slug}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json()
        if (response.status === 404) {
          if (!controller.signal.aborted) {
            setMissing(true)
            setError("Campaign not found")
          }
          return
        }
        const parsed = publicCampaignPageResponseSchema.safeParse(data)
        if (!response.ok || !parsed.success) throw new Error("Invalid campaign response")
        if (!controller.signal.aborted) setCampaign(parsed.data.campaign)
      } catch {
        if (!controller.signal.aborted) setError("Failed to load campaign page. Please refresh to retry.")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void fetchCampaign()
    return () => controller.abort()
  }, [slug])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        </div>
        <Footer />
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">{missing ? "404" : "Unable to Load Campaign"}</h1>
          <h2 className="mb-2 text-2xl font-semibold text-gray-700">{missing ? "Campaign Not Found" : "Please Try Again"}</h2>
          <p role="alert" className="mb-8 max-w-md text-gray-500">
            {missing ? "The promotional page you are looking for does not exist or has expired." : error}
          </p>
          <Link href="/" className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700">
            Return to Homepage
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <main className="relative w-full flex-1">
        {campaign.banner && <h1 className="sr-only">{campaign.name}</h1>}
        {campaign.banner ? (
          <div className="relative flex min-h-[160px] w-full items-center justify-center overflow-hidden border-b border-gray-100 bg-gray-100 shadow-sm md:min-h-[300px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={campaign.banner} alt={campaign.name} className="h-auto max-h-[500px] w-full object-cover" />
          </div>
        ) : (
          <div className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 px-4 py-16 text-center text-white">
            <h1 className="text-3xl font-bold md:text-5xl">{campaign.name}</h1>
            <p className="mt-3 text-white/90">Biggest Deals. Brighter Days.</p>
          </div>
        )}

        <section className="container mx-auto px-4 py-12 md:py-16">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
            <span className="text-sm font-medium text-gray-500">{campaign.products.length} Items</span>
          </div>

          {campaign.products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4 lg:gap-8">
              {campaign.products.map(product => <CategoryProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-20 text-center">
              <h3 className="mb-1 text-lg font-semibold text-gray-700">Coming Soon</h3>
              <p className="text-sm text-gray-500">Products are currently being curated for {campaign.name}. Check back shortly!</p>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  )
}
