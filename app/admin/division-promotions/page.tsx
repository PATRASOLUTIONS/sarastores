"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSWRConfig } from "swr"
import toast from "react-hot-toast"
import { Loader2 } from "lucide-react"
import { apiFetchJson } from "@/lib/api-client"
import { siteBannerListResponseSchema, type SiteBanner } from "@/hooks/useBanners"
import { imageUploadResponseSchema } from "@/lib/media-response"
import { fetchTaxonomy } from "@/lib/taxonomy-client"
import { titleCaseLabel } from "@/lib/product-display"
import { ListingHero, ListingPromoRow } from "@/components/products/ListingBanners"

type Slot = {
  id?: string
  title: string
  subtitle: string
  ctaText: string
  ctaLink: string
  image: string
  active: boolean
}

const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"

function emptySlot(): Slot {
  return { title: "", subtitle: "", ctaText: "", ctaLink: "", image: "", active: true }
}

function fromBanner(banner: SiteBanner | undefined): Slot {
  if (!banner) return emptySlot()
  return {
    id: banner.id,
    title: banner.title || "",
    subtitle: banner.subtitle || "",
    ctaText: banner.ctaText || "",
    ctaLink: banner.ctaLink || "",
    image: banner.image || "",
    active: banner.active !== false,
  }
}

export default function DivisionPromotionsPage() {
  const [divisions, setDivisions] = useState<string[]>([])
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [division, setDivision] = useState("")
  const [hero, setHero] = useState<Slot>(emptySlot())
  const [promos, setPromos] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<"hero" | number | null>(null)
  const { mutate } = useSWRConfig()

  const load = async () => {
    setLoading(true)
    try {
      const [tree, bannerData] = await Promise.all([
        fetchTaxonomy(),
        apiFetchJson("/api/listing-banners?all=1", undefined, siteBannerListResponseSchema.parse),
      ])
      const names = tree.map((item) => item.name).filter(Boolean)
      setDivisions(names)
      setBanners(bannerData)
      setDivision((current) => current || names[0] || "")
    } catch {
      toast.error("Could not load divisions")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!division) return
    const scoped = (placement: "hero" | "promo") =>
      banners.filter((banner) => banner.placement === placement && (banner.scope || "").trim().toLowerCase() === division.trim().toLowerCase())
    setHero(fromBanner(scoped("hero")[0]))
    const existing = scoped("promo")
    setPromos([
      fromBanner(existing[0]),
      fromBanner(existing[1]),
    ])
  }, [division, banners])

  const upload = async (file: File, apply: (url: string) => void) => {
    try {
      const body = new FormData()
      body.append("file", file)
      const json = await apiFetchJson("/api/media/upload", { method: "POST", body }, imageUploadResponseSchema.parse)
      const url = json.images?.[0]?.url
      if (!url) throw new Error(json.errors?.[0] || json.error || "Upload failed")
      apply(url)
      toast.success("Photo uploaded")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    }
  }

  const save = async (placement: "hero" | "promo", slot: Slot, order: number) => {
    if (!division) return
    if (!slot.image) return toast.error("Upload a photo first")
    setSaving(placement === "hero" ? "hero" : order)
    try {
      const payload = {
        placement,
        scope: division,
        title: slot.title.trim(),
        subtitle: slot.subtitle.trim(),
        script: "",
        ctaText: slot.ctaText.trim(),
        ctaLink: slot.ctaLink.trim(),
        image: slot.image,
        bgFrom: "#1560BD",
        bgTo: "#0B3C87",
        accent: "#E11D2E",
        dark: false,
        bullets: [],
        order,
        active: slot.active,
      }
      if (slot.id) {
        await apiFetchJson(`/api/listing-banners?id=${slot.id}`, { method: "PUT", json: payload })
      } else {
        await apiFetchJson("/api/listing-banners", { method: "POST", json: payload })
      }
      toast.success("Saved")
      await mutate((key) => typeof key === "string" && key.startsWith("/api/listing-banners"))
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save")
    } finally {
      setSaving(null)
    }
  }

  const previewHero: SiteBanner = {
    ...hero,
    id: hero.id || "preview-hero",
    placement: "hero",
    scope: division,
  }
  const previewPromos: SiteBanner[] = promos.map((slot, index) => ({
    ...slot,
    id: slot.id || `preview-promo-${index}`,
    placement: "promo" as const,
    scope: division,
  }))

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Division promotions</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Each division opens its own page, for example{" "}
          <Link href="/products?division=Mobile" className="font-semibold text-brand-primary">/products?division=Mobile</Link>.
          Open a division here to set its banner and the two promotions at the bottom of that page.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading divisions</div>
      ) : divisions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-sm text-gray-500">
          No divisions yet. Classify products with a division and they will appear here automatically.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-2">
            {divisions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setDivision(name)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${division === name ? "bg-brand-primary font-semibold text-white" : "text-gray-700 hover:bg-gray-50"}`}
              >
                {titleCaseLabel(name)}
              </button>
            ))}
          </aside>

          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">{titleCaseLabel(division)}</h2>
              <Link href={`/products?division=${encodeURIComponent(division)}`} className="text-sm font-semibold text-brand-primary">
                Open this page
              </Link>
            </div>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-base font-bold text-gray-900">Banner</h3>
              <p className="mt-1 text-xs text-gray-500">Shown across the top of this division page. Upload a wide photo, <span className="font-semibold text-gray-700">1400 × 400 px</span>. Words are optional — leave them blank and shoppers see only the photo.</p>
              <SlotFields slot={hero} onChange={setHero} onUpload={(file) => upload(file, (url) => setHero((current) => ({ ...current, image: url })))} />
              <button type="button" disabled={saving === "hero"} onClick={() => void save("hero", hero, 0)} className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving === "hero" ? "Saving…" : "Save banner"}
              </button>
              {hero.image && <div className="mt-4"><ListingHero banner={previewHero} /></div>}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="text-base font-bold text-gray-900">Bottom promotions</h3>
              <p className="mt-1 text-xs text-gray-500">Two photos under the product grid. Each photo should be <span className="font-semibold text-gray-700">800 × 400 px</span>. Add words only if you want them on the photo.</p>
              <div className="mt-4 grid gap-6 md:grid-cols-2">
                {promos.map((slot, index) => (
                  <div key={slot.id || index} className="rounded-xl border border-gray-100 p-4">
                    <p className="mb-3 text-sm font-semibold text-gray-700">Promotion {index + 1}</p>
                    <SlotFields
                      slot={slot}
                      onChange={(next) => setPromos((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))}
                      onUpload={(file) => upload(file, (url) => setPromos((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, image: url } : item)))}
                    />
                    <button type="button" disabled={saving === index} onClick={() => void save("promo", slot, index)} className="mt-4 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                      {saving === index ? "Saving…" : "Save promotion"}
                    </button>
                  </div>
                ))}
              </div>
              {previewPromos.some((slot) => slot.image) && <div className="mt-4"><ListingPromoRow banners={previewPromos.filter((slot) => slot.image)} /></div>}
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

function SlotFields({ slot, onChange, onUpload }: {
  slot: Slot
  onChange: (slot: Slot) => void
  onUpload: (file: File) => void
}) {
  const set = <K extends keyof Slot>(key: K, value: Slot[K]) => onChange({ ...slot, [key]: value })
  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Photo
        <input type="file" accept="image/*" className="mt-1 block w-full text-sm" onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ""
        }} />
      </label>
      {slot.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slot.image} alt="" className="h-28 w-full rounded-lg bg-gray-50 object-contain" />
      )}
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Title <span className="font-normal normal-case tracking-normal text-gray-400">optional</span>
        <input value={slot.title} placeholder="Leave blank for the photo only" onChange={(event) => set("title", event.target.value)} className={`${inputClass} mt-1`} />
      </label>
      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
        Subtitle <span className="font-normal normal-case tracking-normal text-gray-400">optional</span>
        <input value={slot.subtitle} placeholder="Optional" onChange={(event) => set("subtitle", event.target.value)} className={`${inputClass} mt-1`} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Button <span className="font-normal normal-case tracking-normal text-gray-400">optional</span>
          <input value={slot.ctaText} placeholder="Optional" onChange={(event) => set("ctaText", event.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Link <span className="font-normal normal-case tracking-normal text-gray-400">optional</span>
          <input value={slot.ctaLink} placeholder="Optional" onChange={(event) => set("ctaLink", event.target.value)} className={`${inputClass} mt-1`} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={slot.active} onChange={(event) => set("active", event.target.checked)} />
        Show on the division page
      </label>
    </div>
  )
}
