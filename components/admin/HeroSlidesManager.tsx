"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"

interface HeroSlide {
  id: string
  title: string
  subtitle: string
  image: string
  cta: string
  link: string
  active: boolean
  order?: number
}

const NEW_SLIDE: Omit<HeroSlide, "id"> = {
  title: "",
  subtitle: "",
  image: "",
  cta: "Shop Now",
  link: "/products",
  active: true,
}

export default function HeroSlidesManager() {
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [draft, setDraft] = useState<Omit<HeroSlide, "id"> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [movingId, setMovingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadSlides = async () => {
    const response = await apiFetch("/api/hero-slides")
    if (!response.ok) throw new Error("Could not load uploaded slides")
    const data = await response.json()
    setSlides(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    loadSlides()
      .catch(() => toast.error("Could not load uploaded slides"))
      .finally(() => setLoading(false))
  }, [])

  const readPhoto = (file?: File) => {
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
      if (typeof reader.result === "string") {
        setDraft((current) => current ? { ...current, image: reader.result as string } : current)
      }
    }
    reader.onerror = () => toast.error("Could not read that photo")
    reader.readAsDataURL(file)
  }

  const createSlide = async () => {
    if (!draft?.image) {
      toast.error("Upload a photo first")
      return
    }

    setSaving(true)
    try {
      const response = await apiFetch("/api/hero-slides", { method: "POST", json: draft })
      const result = await response.json()
      if (!response.ok) throw new Error(result?.error)
      await loadSlides()
      setDraft(null)
      toast.success("Uploaded slide added")
    } catch {
      toast.error("Could not add uploaded slide")
    } finally {
      setSaving(false)
    }
  }

  const updateSlide = async (slide: HeroSlide, patch: Partial<HeroSlide>) => {
    const response = await apiFetch("/api/hero-slides", {
      method: "PUT",
      json: { ...slide, ...patch, id: slide.id },
    })
    if (!response.ok) throw new Error("Could not update slide")
  }

  const moveSlide = async (index: number, offset: -1 | 1) => {
    const target = index + offset
    if (target < 0 || target >= slides.length) return

    const current = slides[index]
    const adjacent = slides[target]
    const reordered = [...slides]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setSlides(reordered)
    setMovingId(current.id)

    try {
      await Promise.all([
        updateSlide(current, { order: target }),
        updateSlide(adjacent, { order: index }),
      ])
      toast.success("Slide order updated")
    } catch {
      setSlides(slides)
      toast.error("Could not update slide order")
    } finally {
      setMovingId(null)
    }
  }

  const toggleSlide = async (slide: HeroSlide) => {
    try {
      await updateSlide(slide, { active: !slide.active })
      setSlides((current) => current.map((item) => item.id === slide.id ? { ...item, active: !item.active } : item))
    } catch {
      toast.error("Could not update slide")
    }
  }

  const deleteSlide = async (slide: HeroSlide) => {
    if (!confirm("Delete this uploaded slide?")) return
    try {
      const response = await apiFetch(`/api/hero-slides?id=${encodeURIComponent(slide.id)}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Could not delete slide")
      setSlides((current) => current.filter((item) => item.id !== slide.id))
      toast.success("Uploaded slide deleted")
    } catch {
      toast.error("Could not delete slide")
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <ImagePlus className="h-5 w-5" />
            Uploaded hero slides
          </h2>
          <p className="mt-1 text-sm text-gray-600">Upload banner photos and set their carousel order.</p>
        </div>
        <button
          type="button"
          onClick={() => setDraft(draft ? null : { ...NEW_SLIDE })}
          className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          {draft ? <X className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
          {draft ? "Cancel" : "Upload slide"}
        </button>
      </div>

      {draft && (
        <div className="mt-4 grid gap-4 border-t border-gray-200 pt-4 lg:grid-cols-[minmax(260px,1fr)_1fr]">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => readPhoto(event.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex aspect-[16/5] w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 text-sm font-semibold text-gray-600 hover:border-gray-500"
            >
              {draft.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.image} alt="Uploaded slide preview" className="h-full w-full object-cover" />
              ) : (
                <span className="inline-flex items-center gap-2"><Upload className="h-5 w-5" /> Choose banner photo</span>
              )}
            </button>
            <p className="mt-1 text-xs text-gray-500">Recommended 1920 x 600. PNG, JPG or WebP up to 5 MB.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Title (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} placeholder="Subtitle (optional)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={draft.cta} onChange={(event) => setDraft({ ...draft, cta: event.target.value })} placeholder="Button text" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input value={draft.link} onChange={(event) => setDraft({ ...draft, link: event.target.value })} placeholder="/products" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="button" onClick={createSlide} disabled={saving || !draft.image} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add uploaded slide
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Loading slides...</p>
        ) : slides.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No uploaded slides yet.</p>
        ) : slides.map((slide, index) => (
          <div key={slide.id} className={`flex flex-wrap items-center gap-4 rounded-lg border p-3 ${slide.active ? "border-gray-200" : "border-gray-100 bg-gray-50 opacity-70"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slide.image} alt={slide.title || "Hero slide"} className="h-20 w-56 max-w-full rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900">{slide.title || "Untitled slide"}</p>
              <p className="truncate text-xs text-gray-500">{slide.link || "/products"}</p>
              <p className="mt-1 text-xs font-semibold text-gray-600">Position {index + 1}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" title="Move up" aria-label="Move slide up" disabled={index === 0 || movingId !== null} onClick={() => moveSlide(index, -1)} className="rounded-md border p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
              <button type="button" title="Move down" aria-label="Move slide down" disabled={index === slides.length - 1 || movingId !== null} onClick={() => moveSlide(index, 1)} className="rounded-md border p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
              <button type="button" title={slide.active ? "Hide slide" : "Show slide"} aria-label={slide.active ? "Hide slide" : "Show slide"} onClick={() => toggleSlide(slide)} className="rounded-md border p-2">{slide.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
              <button type="button" title="Delete slide" aria-label="Delete slide" onClick={() => deleteSlide(slide)} className="rounded-md border border-red-200 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}