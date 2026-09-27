"use client"

import { useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { apiFetchJson } from "@/lib/api-client"
import { BANNER_PLACEMENTS, BANNER_PLACEMENT_LABELS, type BannerPlacement, type SiteBanner } from "@/hooks/useBanners"
import { ListingHero, ListingPromoRow } from "@/components/products/ListingBanners"
import LandingHero from "@/components/home/landing/LandingHero"
import { PromoDuo, PromoStrip, StatementBand } from "@/components/home/landing/LandingSections"

type Draft = Omit<SiteBanner, "id"> & { id?: string }

const BLANK: Draft = {
  placement: "hero",
  scope: "",
  title: "",
  subtitle: "",
  script: "",
  ctaText: "Shop Now",
  ctaLink: "/products",
  image: "/banners/appliances-lineup.svg",
  bgFrom: "#1560BD",
  bgTo: "#0B3C87",
  accent: "#E11D2E",
  dark: false,
  bullets: [],
  order: 0,
  active: true,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"

export default function ListingBannersAdminPage() {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetchJson<SiteBanner[]>("/api/listing-banners?all=1")
      setBanners(Array.isArray(data) ? data : [])
    } catch {
      toast.error("Could not load banners")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/media/upload", { method: "POST", body, credentials: "include" })
      const json = await res.json()
      if (!res.ok || !json.images?.[0]) throw new Error(json.errors?.[0] || json.error || "Upload failed")
      set("image", json.images[0].url)
      toast.success("Image uploaded")
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const save = async () => {
    if (!draft.title.trim()) return toast.error("Title is required")
    setSaving(true)
    try {
      const { id, ...payload } = draft
      if (id) {
        await apiFetchJson(`/api/listing-banners?id=${id}`, { method: "PUT", json: payload })
        toast.success("Banner updated")
      } else {
        await apiFetchJson("/api/listing-banners", { method: "POST", json: payload })
        toast.success("Banner created")
      }
      setDraft(BLANK)
      load()
    } catch (err: any) {
      toast.error(err.message || "Could not save banner")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await apiFetchJson(`/api/listing-banners?id=${id}`, { method: "DELETE" })
      toast.success("Banner deleted")
      if (draft.id === id) setDraft(BLANK)
      load()
    } catch (err: any) {
      toast.error(err.message || "Could not delete banner")
    }
  }

  const preview: SiteBanner = { ...draft, id: draft.id || "preview", title: draft.title || "Banner title" }

  const renderPreview = () => {
    switch (draft.placement) {
      case "hero":
        return <ListingHero banner={preview} />
      case "promo":
        return <ListingPromoRow banners={[preview]} />
      case "home-hero":
        return <LandingHero />
      case "home-strip":
        return <PromoStrip banner={preview} />
      case "home-duo":
      case "home-card":
        return <PromoDuo banners={[preview]} />
      case "home-statement":
        return <StatementBand banner={preview} />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Banners &amp; Promos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every campaign banner on the home page and the product listing pages. Leave “Scope” blank to show a
          banner everywhere, or type a category name (e.g. <code>TV</code>) to target one listing.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-gray-900">{draft.id ? "Edit banner" : "New banner"}</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Placement">
                <select
                  value={draft.placement}
                  onChange={(e) => set("placement", e.target.value as BannerPlacement)}
                  className={inputClass}
                >
                  {BANNER_PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {BANNER_PLACEMENT_LABELS[placement]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Scope (optional)">
                <input value={draft.scope} onChange={(e) => set("scope", e.target.value)} className={inputClass} placeholder="All listings" />
              </Field>
            </div>

            <Field label="Title">
              <input value={draft.title} onChange={(e) => set("title", e.target.value)} className={inputClass} />
            </Field>

            <Field label="Subtitle">
              <input value={draft.subtitle} onChange={(e) => set("subtitle", e.target.value)} className={inputClass} />
            </Field>

            {(draft.placement === "hero" || draft.placement === "home-hero" || draft.placement === "home-statement") && (
              <Field label="Handwritten note">
                <input value={draft.script} onChange={(e) => set("script", e.target.value)} className={inputClass} />
              </Field>
            )}

            <Field label="Bullet points (comma separated)">
              <input
                value={(draft.bullets || []).join(", ")}
                onChange={(e) =>
                  set(
                    "bullets",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 6),
                  )
                }
                className={inputClass}
                placeholder="Best Offers, Top Brands, Easy EMI"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Button text">
                <input value={draft.ctaText} onChange={(e) => set("ctaText", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Button link">
                <input value={draft.ctaLink} onChange={(e) => set("ctaLink", e.target.value)} className={inputClass} />
              </Field>
            </div>

            <Field label="Artwork">
              <div className="flex gap-2">
                <input value={draft.image} onChange={(e) => set("image", e.target.value)} className={inputClass} placeholder="/banners/…" />
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="inline-flex h-10 flex-shrink-0 items-center gap-1.5 rounded-lg bg-gray-100 px-3 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              {(["bgFrom", "bgTo", "accent"] as const).map((key) => (
                <Field key={key} label={key === "bgFrom" ? "Gradient from" : key === "bgTo" ? "Gradient to" : "Accent"}>
                  <input
                    type="color"
                    value={draft[key] || "#1560BD"}
                    onChange={(e) => set(key, e.target.value)}
                    className="h-10 w-full cursor-pointer rounded-lg border border-gray-300"
                  />
                </Field>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!draft.dark} onChange={(e) => set("dark", e.target.checked)} className="h-4 w-4" />
                Dark text (for light backgrounds)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={draft.active !== false} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                Order
                <input
                  type="number"
                  value={draft.order ?? 0}
                  onChange={(e) => set("order", Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-gray-300 px-2 text-sm"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-primary text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {draft.id ? "Save changes" : "Add banner"}
              </button>
              {draft.id && (
                <button
                  type="button"
                  onClick={() => setDraft(BLANK)}
                  className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-base font-bold text-gray-900">Live preview</h2>
            {renderPreview()}
          </div>

          <div>
            <h2 className="mb-3 text-base font-bold text-gray-900">All banners</h2>
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : banners.length === 0 ? (
              <p className="text-sm text-gray-500">No banners yet — create one on the left.</p>
            ) : (
              <ul className="space-y-2">
                {banners.map((banner) => (
                  <li
                    key={banner.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <span
                      className="h-10 w-16 flex-shrink-0 rounded-md"
                      style={{ backgroundImage: `linear-gradient(115deg, ${banner.bgFrom}, ${banner.bgTo})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{banner.title}</p>
                      <p className="truncate text-xs text-gray-500">
                        {banner.placement} · {banner.scope ? `scope: ${banner.scope}` : "all listings"} ·{" "}
                        {banner.active === false ? "inactive" : "active"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDraft({ ...BLANK, ...banner })}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(banner.id)}
                      className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                      aria-label={`Delete ${banner.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
