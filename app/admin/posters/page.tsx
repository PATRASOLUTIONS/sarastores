"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Images, Loader2, Plus, Save, Trash2, Upload, Wand2, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"
import { renderPosterSvg, type Poster, type PosterMotif } from "@/lib/posters"
import HeroSlidesManager from "@/components/admin/HeroSlidesManager"

type FeatureType = "product" | "category" | "subcategory"

interface PosterFeature {
  type: FeatureType
  id: string
}

interface PosterRow {
  slug: string
  group: string
  eyebrow: string
  headline: string
  subline: string
  cta: string
  url: string
  enabled: boolean
  custom: boolean
  href: string
  feature: { type: FeatureType; name: string } | null
}

interface PosterLink {
  href: string
  feature?: PosterFeature
}

interface Option {
  id: string
  name: string
}

const FEATURE_LABELS: { value: FeatureType | "none"; label: string }[] = [
  { value: "none", label: "Nothing" },
  { value: "product", label: "Product" },
  { value: "subcategory", label: "Sub-category" },
  { value: "category", label: "Category" },
]

const MOTIFS: PosterMotif[] = ["rays", "dots", "grid", "waves", "arcs"]
const GROUPS: Poster["group"][] = ["Festival", "Category", "Offer", "Trust", "Seasonal"]

type Palette = Pick<Poster, "from" | "via" | "to" | "accent" | "ink">

const PALETTES: { name: string; colours: Palette }[] = [
  { name: "Sara navy", colours: { from: "#0F2557", via: "#16336F", to: "#0A1A40", accent: "#FF6A2C", ink: "#0A1A40" } },
  { name: "Festival saffron", colours: { from: "#9C2A0E", via: "#C2410C", to: "#6B1607", accent: "#F5A623", ink: "#6B1607" } },
  { name: "Diwali violet", colours: { from: "#4A148C", via: "#6A1B9A", to: "#2E0854", accent: "#FFB300", ink: "#2E0854" } },
  { name: "Cool blue", colours: { from: "#01579B", via: "#0288D1", to: "#01426F", accent: "#4FC3F7", ink: "#01426F" } },
  { name: "Forest green", colours: { from: "#1B5E20", via: "#2E7D32", to: "#0F3D14", accent: "#A5D6A7", ink: "#0F3D14" } },
  { name: "Clearance red", colours: { from: "#B71C1C", via: "#D32F2F", to: "#7F0000", accent: "#FFC107", ink: "#7F0000" } },
]

const BLANK: Poster = {
  slug: "",
  group: "Offer",
  eyebrow: "LIMITED TIME",
  headline: "Your headline",
  headlineAccent: "here",
  subline: "One line explaining the offer",
  cta: "SHOP NOW",
  motif: "rays",
  ...PALETTES[0].colours,
}

export default function AdminPostersPage() {
  const [posters, setPosters] = useState<PosterRow[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [links, setLinks] = useState<Record<string, PosterLink>>({})
  const [products, setProducts] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [subCategories, setSubCategories] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Poster | null>(null)
  const [creating, setCreating] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const reload = () =>
    apiFetch("/api/posters")
      .then((res) => res.json())
      .then((data) => {
        if (!data?.success) return
        setPosters(data.posters ?? [])
        setEnabled(data.enabled ?? [])
        setLinks(data.links ?? {})
      })

  useEffect(() => {
    reload()
      .catch(() => toast.error("Could not load posters"))
      .finally(() => setLoading(false))
  }, [])

  // Card projection keeps the product list light; the pickers only need id and name.
  useEffect(() => {
    const toOptions = (payload: any, key: string): Option[] => {
      const list = Array.isArray(payload) ? payload : payload?.[key] ?? []
      return list
        .map((item: any) => ({ id: item.id, name: item.name }))
        .filter((o: Option) => o.id && o.name)
        .sort((a: Option, b: Option) => a.name.localeCompare(b.name))
    }

    const load = (url: string, key: string, set: (o: Option[]) => void) =>
      apiFetch(url)
        .then((res) => res.json())
        .then((data) => set(toOptions(data, key)))
        .catch(() => {
          /* The picker degrades to the plain link field. */
        })

    load("/api/products?fields=card", "products", setProducts)
    load("/api/categories", "categories", setCategories)
    load("/api/sub-categories", "subCategories", setSubCategories)
  }, [])

  const optionsFor = (type: FeatureType) =>
    type === "product" ? products : type === "category" ? categories : subCategories

  const setLink = (slug: string, patch: Partial<PosterLink>) => {
    setLinks((prev) => ({
      ...prev,
      [slug]: { ...(prev[slug] ?? { href: "/products" }), ...patch },
    }))
  }

  const setFeatureType = (slug: string, value: FeatureType | "none") => {
    setLink(slug, value === "none" ? { feature: undefined } : { feature: { type: value, id: "" } })
  }

  const toggle = (slug: string) => {
    setEnabled((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  // Rendered in the browser from the same function the API uses, so the preview
  // is the artwork rather than an approximation of it.
  const previewSrc = useMemo(
    () => (draft ? `data:image/svg+xml,${encodeURIComponent(renderPosterSvg(draft))}` : null),
    [draft],
  )

  const saveDraft = async () => {
    if (!draft) return
    setCreating(true)
    try {
      const res = await apiFetch("/api/posters/custom", { method: "POST", json: draft })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || "Could not save poster")
        return
      }
      await reload()
      setDraft(null)
      toast.success("Poster created — tick it, then publish to put it on the homepage")
    } catch {
      toast.error("Could not save poster")
    } finally {
      setCreating(false)
    }
  }

  const uploadPhoto = (file?: File) => {
    if (!file) return
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      toast.error("Choose a PNG, JPG or WebP image")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be smaller than 5 MB")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (draft && typeof reader.result === "string") {
        setDraft({ ...draft, photo: reader.result })
      }
    }
    reader.onerror = () => toast.error("Could not read that photo")
    reader.readAsDataURL(file)
  }

  const removeCustom = async (slug: string) => {
    if (!confirm("Delete this poster? It is also removed from the homepage.")) return
    try {
      const res = await apiFetch(`/api/posters/custom?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        toast.error("Could not delete poster")
        return
      }
      await reload()
      setEnabled((prev) => prev.filter((s) => s !== slug))
      toast.success("Poster deleted")
    } catch {
      toast.error("Could not delete poster")
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiFetch("/api/posters", { method: "PUT", json: { enabled, links } })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || "Could not save")
        return
      }
      toast.success(
        enabled.length === 0
          ? "All posters hidden — the hero will use your uploaded slides"
          : `${enabled.length} poster${enabled.length === 1 ? "" : "s"} live on the homepage`,
      )
    } catch {
      toast.error("Could not save")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading posters…
      </p>
    )
  }

  const groups = Array.from(new Set(posters.map((p) => p.group)))

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Images className="h-6 w-6" />
            Hero posters
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Tick the posters you want in the homepage carousel. They are drawn as vector graphics —
            about 4 KB each instead of the multi-megabyte uploads — so they stay sharp on every
            screen and load instantly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">
            {enabled.length} of {posters.length} selected
          </span>
          <button
            type="button"
            onClick={() => setDraft(draft ? null : { ...BLANK })}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            {draft ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {draft ? "Cancel" : "Create your own"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Publish selection
          </button>
        </div>
      </div>

      {draft && (
        <section className="rounded-xl border-2 border-gray-900 bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Wand2 className="h-4 w-4" />
            Build a poster
          </h2>

          {previewSrc && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewSrc}
              alt="Poster preview"
              className="mt-3 block aspect-[16/5] w-full rounded-lg border border-gray-200 object-cover"
            />
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["eyebrow", "Small label", "GANESH CHATURTHI"],
                ["headline", "Headline", "Ganpati Bappa"],
                ["headlineAccent", "Headline, second line", "Morya"],
                ["subline", "Supporting line", "Up to 60% off on TVs and ACs"],
                ["cta", "Button text", "SHOP THE SALE"],
              ] as const
            ).map(([field, label, placeholder]) => (
              <label key={field} className="block text-xs font-semibold text-gray-700">
                {label}
                <input
                  value={draft[field]}
                  onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                  placeholder={placeholder}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-normal"
                />
              </label>
            ))}

            <label className="block text-xs font-semibold text-gray-700">
              Group
              <select
                value={draft.group}
                onChange={(e) => setDraft({ ...draft, group: e.target.value as Poster["group"] })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-normal"
              >
                {GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>

            <div className="text-xs font-semibold text-gray-700">
              Photo (optional)
              <input
                ref={photoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => uploadPhoto(event.target.files?.[0])}
                className="hidden"
              />
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-gray-400 px-3 py-2 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  {draft.photo ? "Replace photo" : "Upload photo"}
                </button>
                {draft.photo && (
                  <button
                    type="button"
                    title="Remove photo"
                    onClick={() => setDraft({ ...draft, photo: undefined })}
                    className="rounded-lg border border-red-200 px-3 text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1 font-normal text-gray-500">PNG, JPG or WebP, up to 5 MB.</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-700">Background pattern</p>
              <div className="mt-1 flex gap-1">
                {MOTIFS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraft({ ...draft, motif: m })}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
                      draft.motif === m
                        ? "bg-gray-900 text-white"
                        : "border border-gray-300 bg-white text-gray-700"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700">Colour preset</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {PALETTES.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    title={p.name}
                    onClick={() => setDraft({ ...draft, ...p.colours })}
                    className="h-8 w-12 rounded-lg border border-gray-300"
                    style={{
                      background: `linear-gradient(135deg, ${p.colours.from}, ${p.colours.via}, ${p.colours.to})`,
                    }}
                  >
                    <span className="sr-only">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-700">Fine-tune</p>
              <div className="mt-1 flex gap-2">
                {(["from", "via", "to", "accent", "ink"] as const).map((field) => (
                  <label key={field} className="text-[10px] capitalize text-gray-600">
                    {field}
                    <input
                      type="color"
                      value={draft[field]}
                      onChange={(e) => setDraft({ ...draft, [field]: e.target.value })}
                      className="block h-8 w-10 cursor-pointer rounded border border-gray-300"
                    />
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={saveDraft}
              disabled={creating}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save poster
            </button>
          </div>
        </section>
      )}

      {enabled.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nothing selected. The homepage will fall back to the uploaded hero slides below.
        </p>
      )}

      <HeroSlidesManager />

      {groups.map((group) => (
        <section key={group} className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">{group}</h2>

          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {posters
              .filter((p) => p.group === group)
              .map((poster) => {
                const on = enabled.includes(poster.slug)
                const link = links[poster.slug] ?? { href: poster.href ?? "/products" }
                return (
                  <div
                    key={poster.slug}
                    className={`overflow-hidden rounded-xl border transition-shadow ${
                      on ? "border-gray-900 ring-2 ring-gray-900" : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(poster.slug)}
                      aria-pressed={on}
                      className="block w-full text-left"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={poster.url}
                        alt={poster.headline}
                        className="block aspect-[16/5] w-full object-cover"
                        loading="lazy"
                      />
                      <div className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {poster.headline}
                          </p>
                          <p className="truncate text-xs text-gray-500">{poster.subline}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            on ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {on ? "LIVE" : "HIDDEN"}
                        </span>
                      </div>
                    </button>

                    {poster.custom && (
                      <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          YOUR POSTER
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCustom(poster.slug)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}

                    <div className="space-y-2 border-t border-gray-100 bg-gray-50 p-3">
                      <label className="block text-xs font-semibold text-gray-700">
                        Show on this poster
                        <select
                          value={link.feature?.type ?? "none"}
                          onChange={(e) =>
                            setFeatureType(poster.slug, e.target.value as FeatureType | "none")
                          }
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-normal"
                        >
                          {FEATURE_LABELS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      {link.feature ? (
                        <label className="block text-xs font-semibold text-gray-700">
                          Pick one
                          <select
                            value={link.feature.id}
                            onChange={(e) =>
                              setLink(poster.slug, {
                                feature: { type: link.feature!.type, id: e.target.value },
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-normal"
                          >
                            <option value="">Select…</option>
                            {optionsFor(link.feature.type).map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.name.slice(0, 70)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <label className="block text-xs font-semibold text-gray-700">
                          Link to a page
                          <input
                            value={link.href}
                            onChange={(e) => setLink(poster.slug, { href: e.target.value })}
                            placeholder="/products"
                            className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-normal"
                          />
                        </label>
                      )}

                      <p className="text-[11px] text-gray-500">
                        {link.feature
                          ? link.feature.id
                            ? "Its photo and name appear on the banner, and clicking the poster opens it."
                            : "Nothing picked yet — the poster will fall back to /products."
                          : "Site-relative paths only, e.g. /products, /offers or /category/<id>."}
                      </p>
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}
