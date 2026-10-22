"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Check, ExternalLink, ImageIcon, Loader2, Save, Search, Trash2, Upload } from "lucide-react"
import toast from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"
import { fetchAllAdminProducts, type AdminProductResponse } from "@/lib/admin-products-client"
import { campaignPageListResponseSchema } from "@/lib/campaign-page"
import { DEFAULT_HEADER_PROMOTIONS, type HeaderPromotion } from "@/lib/header-promotions"
import { useSubmitLock } from "@/hooks/useSubmitLock"

const CAMPAIGN_NAME = "SARA Super Sunday"
const CAMPAIGN_SLUG = "super-sunday"

export default function SuperSundayAdminPage() {
  const lock = useSubmitLock()
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [banner, setBanner] = useState("")
  const [published, setPublished] = useState(true)
  const [products, setProducts] = useState<AdminProductResponse[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [headerPromos, setHeaderPromos] = useState<HeaderPromotion[]>(DEFAULT_HEADER_PROMOTIONS)
  const [savingHeader, setSavingHeader] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [campaignResponse, catalogue, headerResponse] = await Promise.all([
          apiFetch("/api/admin/campaign-pages", { cache: "no-store" }),
          fetchAllAdminProducts(),
          apiFetch("/api/header-promotions", { cache: "no-store" }),
        ])
        const campaignData = campaignPageListResponseSchema.safeParse(await campaignResponse.json())
        if (!campaignResponse.ok || !campaignData.success) throw new Error("Campaign settings could not be loaded")

        const activeProducts = catalogue.filter(product => product.active === true)
        const activeIds = new Set(activeProducts.map(product => product.id))
        const campaign = campaignData.data.campaigns.find(item => item.slug === CAMPAIGN_SLUG)
        if (cancelled) return

        const headerData = await headerResponse.json().catch(() => null)
        if (Array.isArray(headerData?.promotions) && headerData.promotions.length === 2) {
          setHeaderPromos(headerData.promotions)
        }
        setProducts(activeProducts)
        if (campaign) {
          setCampaignId(campaign.id)
          setBanner(campaign.banner || "")
          setPublished(campaign.isActive)
          setSelectedIds(campaign.productIds.filter(id => activeIds.has(id)))
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Super Sunday could not be loaded")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products
    return products.filter(product =>
      String(product.name || "").toLowerCase().includes(term) ||
      String(product.sku || product.itemno || "").toLowerCase().includes(term) ||
      String(product.manufacturerName || product.manufacturer_name || "").toLowerCase().includes(term)
    )
  }, [products, search])

  const selected = new Set(selectedIds)
  const toggleProduct = (id: string) => {
    setSelectedIds(previous => {
      if (previous.includes(id)) return previous.filter(productId => productId !== id)
      if (previous.length >= 500) {
        toast.error("A campaign can contain up to 500 products")
        return previous
      }
      return [...previous, id]
    })
  }

  const saveHeaderPromos = async () => {
    if (!lock.acquire()) return
    setSavingHeader(true)
    try {
      const response = await apiFetch("/api/header-promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(headerPromos.map(({ id, title, href, description, enabled }) => ({
          id, title, href, description, enabled,
        }))),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Header offers could not be saved")
      toast.success("Header offers saved")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Header offers could not be saved")
    } finally {
      lock.release()
      setSavingHeader(false)
    }
  }

  const uploadBanner = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Use a JPG, PNG or WebP banner")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Banner must be 5 MB or smaller")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") setBanner(reader.result)
    }
    reader.onerror = () => toast.error("Banner could not be read")
    reader.readAsDataURL(file)
  }

  const save = async () => {
    if (!lock.acquire()) return
    setSaving(true)
    try {
      const response = await apiFetch(
        campaignId ? `/api/admin/campaign-pages/${campaignId}` : "/api/admin/campaign-pages",
        {
          method: campaignId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: CAMPAIGN_NAME,
            slug: CAMPAIGN_SLUG,
            banner,
            isActive: published,
            productIds: selectedIds,
          }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success !== true) throw new Error(data.error || "Super Sunday could not be saved")
      if (!campaignId && typeof data.campaign?.id === "string") setCampaignId(data.campaign.id)
      toast.success(`Super Sunday ${published ? "published" : "saved as draft"} with ${selectedIds.length} products`)
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Super Sunday could not be saved")
    } finally {
      lock.release()
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-red-600" /></div>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">SARA Super Sunday</h1>
          <p className="mt-1 text-sm text-gray-600">Select the active products shown on the public Super Sunday page.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/super-sunday" target="_blank" className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Preview <ExternalLink className="h-4 w-4" />
          </Link>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Header offers</h2>
            <p className="mt-1 text-sm text-gray-600">SARA Super Sunday shows on Sunday. Full Moon Day shows on Monday. Every other day the header hides both. Times follow India Standard Time.</p>
          </div>
          <button type="button" onClick={saveHeaderPromos} disabled={savingHeader} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50">
            {savingHeader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save header offers
          </button>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {headerPromos.map((promo, index) => (
            <div key={promo.id} className="rounded-lg border border-gray-200 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={promo.enabled}
                  onChange={event => setHeaderPromos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: event.target.checked } : item))}
                  className="h-4 w-4 rounded border-gray-300 text-red-600"
                />
                Show on {promo.weekday === 0 ? "Sunday" : "Monday"}
              </label>
              <label className="mt-3 block text-xs font-medium text-gray-600">
                Title
                <input
                  value={promo.title}
                  onChange={event => setHeaderPromos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="mt-3 block text-xs font-medium text-gray-600">
                Link
                <input
                  value={promo.href}
                  onChange={event => setHeaderPromos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="mt-3 block text-xs font-medium text-gray-600">
                Short line
                <input
                  value={promo.description}
                  onChange={event => setHeaderPromos(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Page Banner</h2>
            <p className="mt-1 text-sm text-gray-600">
              Recommended size: <strong>1920 × 600 px</strong>. JPG, PNG or WebP; maximum 5 MB.
            </p>
          </div>
          <div className="flex gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
              <Upload className="h-4 w-4" />
              {banner ? "Replace Banner" : "Upload Banner"}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadBanner} className="sr-only" />
            </label>
            {banner && (
              <button
                type="button"
                onClick={() => setBanner("")}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border bg-gray-50">
          {banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={banner} alt="Super Sunday banner preview" className="aspect-[16/5] w-full object-cover" />
          ) : (
            <div className="flex aspect-[16/5] items-center justify-center gap-2 text-sm text-gray-500">
              <ImageIcon className="h-5 w-5" />
              No banner uploaded
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm">
        <label className="flex items-center gap-3 text-sm font-medium text-gray-800">
          <input type="checkbox" checked={published} onChange={event => setPublished(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-red-600" />
          Publish Super Sunday page
        </label>
        <p className="text-sm font-semibold text-red-700">{selectedIds.length} product{selectedIds.length === 1 ? "" : "s"} selected</p>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="relative mb-5 max-w-xl">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search active products by name, SKU or brand"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
          />
        </div>

        {filteredProducts.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map(product => {
              const isSelected = selected.has(product.id)
              const image = product.image || product.images?.[0] || "/placeholder.svg"
              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                    isSelected ? "border-red-500 bg-red-50 ring-1 ring-red-200" : "border-gray-200 hover:border-gray-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="" className="h-16 w-16 shrink-0 rounded-lg bg-gray-50 object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold text-gray-900">{product.name || "Unnamed product"}</span>
                    <span className="mt-1 block text-xs text-gray-500">{product.sku || product.itemno || "No SKU"} · Stock {Number(product.stock || 0)}</span>
                  </span>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-red-600 bg-red-600 text-white" : "border-gray-300 text-transparent"}`}>
                    <Check className="h-4 w-4" />
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-gray-500">No active products match this search.</p>
        )}
      </div>
    </div>
  )
}
