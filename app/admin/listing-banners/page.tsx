"use client"

import SiteImage from "@/components/SiteImage"
import { useEffect, useRef, useState } from "react"
import { useSWRConfig } from "swr"
import toast from "react-hot-toast"
import { Loader2, Plus, Trash2, Upload } from "lucide-react"
import { apiFetchJson } from "@/lib/api-client"
import { BANNER_PLACEMENTS, BANNER_PLACEMENT_LABELS, bannerIsPhotoOnly, useBannerClock, siteBannerListResponseSchema, siteBannerResponseSchema, type BannerPlacement, type SiteBanner } from "@/hooks/useBanners"
import { imageUploadResponseSchema } from "@/lib/media-response"
import BannerSectionPreview from "@/components/admin/BannerSectionPreview"
import BannerPlacementMap from "@/components/admin/BannerPlacementMap"
import { BANNER_LOCATIONS } from "@/lib/banner-placements"
import { BANNER_UPDATE_KEY, BannerScheduleSchema, bannerVisibilityStatus, bannerScheduleSummary, selectVisibleBanners } from "@/lib/banner-schedule"
import BannerScheduleEditor from "@/components/admin/BannerScheduleEditor"

type Draft = Omit<SiteBanner, "id"> & { id?: string }

const BLANK: Draft = {
  placement: "home-hero",
  scope: "",
  title: "",
  subtitle: "",
  script: "",
  ctaText: "",
  ctaLink: "/products",
  image: "",
  bgFrom: "#1560BD",
  bgTo: "#0B3C87",
  accent: "#E11D2E",
  dark: false,
  bullets: [],
  order: 0,
  active: false,
  expiresAt: null,
  startsAt: null,
  weekdays: null,
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  )
}

const BANNER_PHOTO_SIZES: Record<BannerPlacement, string> = {
  hero: "1920 × 600 px",
  promo: "960 × 400 px",
  "home-hero": "1920 × 768 px",
  "home-strip": "1920 × 320 px",
  "home-duo": "700 × 280 px",
  "home-card": "800 × 360 px",
  "home-statement": "1920 × 280 px",
  "pdp-offer": "800 × 360 px",
  "pdp-rail": "480 × 640 px",
  "brands-hero": "1920 × 480 px",
  "cart-promo": "640 × 480 px",
}

const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"

export default function ListingBannersAdminPage() {
  const [banners, setBanners] = useState<SiteBanner[]>([])
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState<string>()
  const [placementFilter, setPlacementFilter] = useState("all")
  const [dirty, setDirty] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const { mutate } = useSWRConfig()
  const now = useBannerClock(banners)
  const invalidate = async () => {
    await mutate((key) => typeof key === "string" && key.startsWith("/api/listing-banners"))
    try { window.localStorage.setItem(BANNER_UPDATE_KEY, String(Date.now())) } catch { /* Polling remains available if storage is disabled. */ }
  }

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiFetchJson("/api/listing-banners?all=1", undefined, siteBannerListResponseSchema.parse)
      setBanners(data)
    } catch {
      toast.error("Could not load banners")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => { setDirty(true); setDraft((d) => ({ ...d, [key]: value })) }
  const editBanner = (banner: SiteBanner) => { setDraft({ ...BLANK, ...banner }); setDirty(false); document.getElementById('banner-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const addToPlacement = (placement: BannerPlacement) => { setDraft({ ...BLANK, placement }); setDirty(false); document.getElementById('banner-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const json = await apiFetchJson("/api/listing-banners/upload", { method: "POST", body }, imageUploadResponseSchema.parse)
      if (!json.images?.[0]) throw new Error(json.errors?.[0] || json.error || "Upload failed")
      set("image", json.images[0].url)
      toast.success("Image uploaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const save = async () => {
    if (!draft.title.trim() && !(draft.image || "").trim()) return toast.error("Add a title or upload a photo")
    const schedule = BannerScheduleSchema.safeParse(draft)
    if (!schedule.success) {
      const issue = schedule.error.issues[0]
      toast.error(issue.message)
      document.getElementById(`banner-${issue.path[0]}`)?.focus()
      return
    }
    setSaving(true)
    try {
      const { id, ...payload } = draft
      let savedId = id
      if (id) {
        await apiFetchJson(`/api/listing-banners?id=${id}`, { method: "PUT", json: payload })
        toast.success("Banner updated")
      } else {
        const created = await apiFetchJson("/api/listing-banners", { method: "POST", json: payload }, siteBannerResponseSchema.parse)
        savedId = created.id
        toast.success("Banner created")
      }
      setDraft({ ...payload, id: savedId })
      setDirty(false)
      await invalidate()
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save banner")
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!window.confirm("Delete this banner permanently?")) return
    setBusyId(id)
    try {
      await apiFetchJson(`/api/listing-banners?id=${id}`, { method: "DELETE" })
      toast.success("Banner deleted")
      if (draft.id === id) setDraft(BLANK)
      await invalidate()
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete banner")
    } finally {
      setBusyId(undefined)
    }
  }

  const toggle = async (banner: SiteBanner) => {
    if (!banner.active && banner.expiresAt && Date.parse(banner.expiresAt) <= Date.now()) return toast.error("This poster expired. Edit its end date or choose Never end before turning it on.")
    setBusyId(banner.id)
    try {
      const active = !banner.active
      await apiFetchJson(`/api/listing-banners?id=${banner.id}`, { method: "PUT", json: { active } })
      if (draft.id === banner.id) set("active", active)
      setBanners((current) => current.map((item) => item.id === banner.id ? { ...item, active } : item))
      await invalidate()
      toast.success(active ? "Banner turned on" : "Banner turned off")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not change banner visibility")
    } finally {
      setBusyId(undefined)
    }
  }

  const preview: SiteBanner = { ...draft, id: draft.id || "preview" }
  const mappedBanners = dirty && (preview.title || preview.image) ? [...banners.filter(banner => banner.id !== preview.id), preview] : banners
  const location = BANNER_LOCATIONS[draft.placement]

  const renderPreview = () => {
    const homeSide = selectVisibleBanners(banners.filter(banner => banner.placement === 'home-duo' && banner.id !== preview.id))
    const candidates = draft.placement === 'home-duo' ? [preview, ...homeSide].slice(0, 2) : [preview]
    return <BannerSectionPreview placement={draft.placement} banners={candidates} scope={draft.scope} homeSide={homeSide} homeHero={selectVisibleBanners(banners.filter(banner => banner.placement === 'home-hero'))} />
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Banners &amp; Promos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage posters by their actual page and section. Choose weekdays and a visibility date range, upload artwork, and save changes to publish. Audience targeting is available for listing divisions and product brands; leave it blank for the default audience of that placement.
        </p>
        <p className="mt-2 text-sm text-gray-600">New posters start off. Turn on the ones you want to show. Main posters rotate; the first two enabled sub banners and first three enabled below-deals banners appear by order. The first enabled Cart promotional banner appears by order; turning all Cart banners off hides its promotional area. A banner with a photo and no title, subtitle, note, bullets or button fills the full width.</p>
        <ul className="mt-3 grid gap-1 text-sm text-gray-700 sm:grid-cols-2">
          {BANNER_PLACEMENTS.map(placement => (
            <li key={placement}><strong>{BANNER_PLACEMENT_LABELS[placement]}:</strong> {BANNER_PHOTO_SIZES[placement]}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div id="banner-editor" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-gray-900">{draft.id ? "Edit banner" : "New banner"}</h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Placement">
                <select
                  value={draft.placement}
                  onChange={(e) => { const placement = e.target.value as BannerPlacement; set("placement", placement); if (!BANNER_LOCATIONS[placement].scope) set("scope", "") }}
                  className={inputClass}
                >
                  {BANNER_PLACEMENTS.map((placement) => (
                    <option key={placement} value={placement}>
                      {BANNER_PLACEMENT_LABELS[placement]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={location.scope || "Audience"}>
                <input value={draft.scope} onChange={(e) => set("scope", e.target.value)} className={inputClass} placeholder={location.scope ? 'All audiences' : 'All visitors'} disabled={!location.scope && !draft.scope} />
              </Field>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900"><p className="font-semibold">{location.page} · {location.section}</p><p className="mt-1 text-xs leading-5">{location.note}</p>{!location.scope && draft.scope && <p className="mt-2 font-semibold">Clear Audience to display this poster on this page.</p>}</div>

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

            {/* Not a <label>: a file input and its trigger button inside one get their clicks redirected to the text field. */}
            <div>
              <label htmlFor="banner-artwork-url" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Artwork — {BANNER_PHOTO_SIZES[draft.placement]}
              </label>
              <p className="mb-2 text-xs text-gray-500">Upload at {BANNER_PHOTO_SIZES[draft.placement]}. Leave the title, subtitle, note, bullets and button empty to show this photo at full width.</p>
              <div className="flex gap-2">
                <input id="banner-artwork-url" value={draft.image} onChange={(e) => set("image", e.target.value)} className={inputClass} placeholder="/banners/…" />
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
            </div>

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

            <BannerScheduleEditor schedule={draft} onChange={schedule => { setDirty(true); setDraft(current => ({ ...current, ...schedule })) }} />
            <div className="flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!draft.dark} onChange={(e) => set("dark", e.target.checked)} className="h-4 w-4" />
                Dark text (for light backgrounds)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={draft.active !== false} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4" />
                On — show when its schedule allows
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
                disabled={saving || uploading}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-primary text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {draft.id ? "Save changes" : "Add banner"}
              </button>
              {draft.id && (
                <button
                  type="button"
                  onClick={() => { setDraft(BLANK); setDirty(false) }}
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
            <h2 className="mb-2 text-base font-bold text-gray-900">{location.page} — {location.section}</h2>
            <p className="mb-3 text-xs text-gray-500">{dirty ? 'Unsaved artwork preview — Save to publish.' : 'Artwork preview.'} This uses the storefront section’s own component. Visibility and slot selection are shown in the placement map.</p>
            {bannerIsPhotoOnly(preview) || preview.title.trim() || preview.image ? renderPreview() : <p className="text-sm text-gray-500">Add a title or a photo to preview this banner.</p>}
          </div>

          <div>
            <h2 className="mb-3 text-base font-bold text-gray-900">Inspect page and section</h2>
            <label className="mb-3 block text-sm text-gray-600">
              Filter placement
              <select value={placementFilter} onChange={(event) => setPlacementFilter(event.target.value)} className={`${inputClass} mt-1`}>
                <option value="home">All homepage banners</option>
                <option value="all">All placements</option>
                {BANNER_PLACEMENTS.map((placement) => <option key={placement} value={placement}>{BANNER_PLACEMENT_LABELS[placement]}</option>)}
              </select>
            </label>
            {!loading && <BannerPlacementMap banners={mappedBanners} draftId={dirty ? preview.id : undefined} filter={placementFilter} edit={editBanner} add={addToPlacement} />}
            <h2 className="mb-3 mt-6 text-base font-bold text-gray-900">Manage saved posters</h2>
            {loading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : banners.length === 0 ? (
              <p className="text-sm text-gray-500">No banners yet — create one on the left.</p>
            ) : (
              <ul className="space-y-2">
                {banners.filter((banner) => placementFilter === "all" || (placementFilter === "home" ? banner.placement.startsWith("home-") : banner.placement === placementFilter)).map((banner) => (
                  <li
                    key={banner.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <span className="flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md" style={{ backgroundImage: `linear-gradient(115deg, ${banner.bgFrom}, ${banner.bgTo})` }}>
                      {banner.image && <SiteImage unoptimized src={banner.image} alt="" className="h-full w-full object-contain" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{banner.title || 'Photo-only poster'}</p>
                      <p className="truncate text-xs text-gray-500">
                        {BANNER_PLACEMENT_LABELS[banner.placement]} · {banner.scope || "all audiences"} ·{" "}
                        {bannerVisibilityStatus(banner, now)}
                      </p>
                      <p className="text-xs text-gray-500">{bannerScheduleSummary(banner)}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={banner.active === true}
                      aria-label={`Visibility of ${banner.title}`}
                      disabled={busyId === banner.id}
                      onClick={() => void toggle(banner)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${banner.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}
                    >
                      {busyId === banner.id ? "Saving..." : banner.active ? "On" : "Off"}
                    </button>
                    <button
                      type="button"
                      onClick={() => editBanner(banner)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(banner.id)}
                      disabled={busyId === banner.id}
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
