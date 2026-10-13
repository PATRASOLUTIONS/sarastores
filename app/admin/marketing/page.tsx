"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ExternalLink, Loader2, Megaphone, Save, Upload } from "lucide-react"
import toast from "react-hot-toast"
import { useSWRConfig } from "swr"
import { apiFetchJson } from "@/lib/api-client"
import { defaultMarketingContent, MARKETING_PAGES, MARKETING_SECTIONS, marketingResponseSchema, type MarketingContent, type MarketingPage } from "@/lib/marketing-content"
import { imageUploadResponseSchema } from "@/lib/media-response"
import { z } from "zod"

const marketingSaveResponseSchema = z.object({ section: marketingResponseSchema.shape.sections.element })

const TOOLS = [
  { title: "Banners & Promos", href: "/admin/listing-banners", detail: "Homepage, listings, product rails, brands and cart artwork, links and ordering" },
  { title: "Coupons & Offers", href: "/admin/promotions", detail: "Real coupons and published promotional offers" },
  { title: "Theme & Festivals", href: "/admin/theme", detail: "Festival announcement bar and storefront theme" },
  { title: "Campaigns & Email", href: "/admin/customer-centric", detail: "Audiences, email/WhatsApp campaigns and retention" },
  { title: "Email Templates", href: "/admin/customer-centric/templates", detail: "Campaign message templates" },
  { title: "Categories & Brands", href: "/admin/catalogue", detail: "Enabled categories, brand logos and brand landing pages" },
  { title: "Branding & Settings", href: "/admin/settings", detail: "Company figures, logo, contact, social and app-store links" },
  { title: "Homepage Merchandising", href: "/admin/home-components", detail: "Additional curated product sections" },
  { title: "Custom Campaign Pages", href: "/admin/campaign-pages", detail: "Campaign landing-page content" },
  { title: "Leads & Newsletter", href: "/admin/leads", detail: "Subscribers and marketing leads" },
  { title: "Spin Campaigns", href: "/admin/spin-wheel/campaigns", detail: "Prize campaigns and spin-wheel marketing" },
  { title: "Lucky Draw", href: "/admin/lucky-draw", detail: "Lucky-draw campaigns and winners" },
  { title: "Site Features", href: "/admin/features", detail: "Existing storefront feature switches" },
  { title: "Advertisements", href: "/admin/advertisements", detail: "Storefront advertisements and placements" },
  { title: "Product Ads", href: "/admin/product-advertisements", detail: "Product-specific advertising placements" },
]
const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900"

export default function MarketingAdminPage() {
  const [page, setPage] = useState<MarketingPage>("home")
  const [selected, setSelected] = useState("hero")
  const [saved, setSaved] = useState<MarketingContent[]>([])
  const [draft, setDraft] = useState<MarketingContent>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState("")
  const [dirty, setDirty] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const { mutate } = useSWRConfig()
  const sections = MARKETING_SECTIONS.filter(section => section.page === page)
  const definition = sections.find(section => section.section === selected) || sections[0]

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await apiFetchJson("/api/marketing-content", undefined, marketingResponseSchema.parse)
      setSaved(data.sections); setDirty(false); setLoaded(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load marketing content")
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    setDraft(saved.find(section => section.page === definition.page && section.section === definition.section) ||
      defaultMarketingContent(definition))
    setDirty(false)
  }, [definition, saved])

  const canSwitch = () => !dirty || window.confirm("Discard unsaved marketing changes?")
  const setValue = (key: string, value: string) => {
    setDraft(current => current ? { ...current, values: { ...current.values, [key]: value } } : current)
    setDirty(true)
  }
  const save = async () => {
    if (!draft || !loaded) return
    setSaving(true); setError("")
    try {
      const { id, ...payload } = draft
      const response = await apiFetchJson("/api/marketing-content", { method: "PUT", json: payload }, marketingSaveResponseSchema.parse)
      setSaved(current => [...current.filter(item => item.id !== response.section.id), response.section])
      await mutate("/api/marketing-content")
      toast.success("Marketing section saved. Storefront pages now use these settings.")
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not save marketing content"
      setError(message); toast.error(message)
    } finally { setSaving(false) }
  }
  const upload = async (key: string, file: File) => {
    setUploading(key)
    try {
      const form = new FormData(); form.append("file", file)
      const response = await apiFetchJson("/api/media/upload", { method: "POST", body: form }, imageUploadResponseSchema.parse)
      if (!response.images?.[0]?.url) throw new Error(response.errors?.[0] || response.error || "Image upload failed")
      setValue(key, response.images[0].url)
      toast.success("Image uploaded. Save the section to publish it.")
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Image upload failed") }
    finally { setUploading("") }
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-[#0f2557]"><Megaphone size={26} />Marketing &amp; Controls</h1>
        <p className="mt-2 text-sm text-slate-600">Control marketing copy, artwork, links and section visibility across the updated storefront pages.</p></div>
      <Link href={MARKETING_PAGES.find(item => item.id === page)?.href || "/"} target="_blank" className="inline-flex items-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm">View storefront <ExternalLink size={15} /></Link>
    </div>
    <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
      Prices, stock, genuine reviews and company figures retain their existing data sources. Bank discounts and EMI eligibility are supplied by Razorpay, not entered as marketing promises.
      Saved content refreshes on storefront focus and within 30 seconds. Section order is available for page-level content; purchase controls and filters retain their fixed layout.
    </p>
    <section aria-label="Marketing page controls" className="overflow-hidden rounded-xl border bg-white">
      <nav aria-label="Pages to control" className="flex flex-wrap gap-1 border-b p-3">
        {MARKETING_PAGES.map(item => <button key={item.id} type="button" onClick={() => {
          if (canSwitch()) { setPage(item.id); setSelected(MARKETING_SECTIONS.find(section => section.page === item.id)!.section) }
        }} aria-pressed={page === item.id} className={`rounded-lg px-3 py-2 text-sm ${page === item.id ? "bg-[#1560bd] text-white" : "text-slate-700 hover:bg-slate-100"}`}>{item.label}</button>)}
      </nav>
      <div className="grid md:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Marketing sections" className="border-b bg-slate-50 p-3 md:border-b-0 md:border-r">
          {[...sections].sort((a, b) => (saved.find(item => item.id === `${a.page}:${a.section}`)?.order ?? a.order) -
            (saved.find(item => item.id === `${b.page}:${b.section}`)?.order ?? b.order)).map(section => {
            const config = saved.find(item => item.id === `${section.page}:${section.section}`)
            return <button key={section.section} type="button" onClick={() => { if (canSwitch()) setSelected(section.section) }}
              aria-pressed={definition.section === section.section} className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg p-3 text-left text-sm ${definition.section === section.section ? "bg-white font-semibold text-[#1560bd] shadow-sm" : "text-slate-700"}`}>
              {section.title}<span className={`text-[10px] ${config?.enabled === false ? "text-slate-500" : "text-green-700"}`}>{config?.enabled === false ? "Hidden" : "Visible"}</span>
            </button>
          })}
        </nav>
        <div className="min-w-0 p-4 sm:p-6">
          {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error} <button type="button" onClick={() => { if (canSwitch()) void load() }} className="underline">Reload content</button></p>}
          {loading ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={18} className="animate-spin" />Loading marketing controls...</p> : loaded && draft && <>
            <h2 className="text-lg font-bold text-slate-900">{definition.title}</h2>
            {definition.note && <p className="mt-2 text-xs leading-relaxed text-slate-500">{definition.note}</p>}
            {definition.tool && <Link href={definition.tool} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-[#1560bd]">Open existing content manager <ExternalLink size={14} /></Link>}
            <div className="my-5 flex flex-wrap items-center gap-5">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} onChange={event => { setDraft({ ...draft, enabled: event.target.checked }); setDirty(true) }} />Show this section</label>
              {!definition.pinned && <label className="flex items-center gap-2 text-sm">Section order <input aria-label="Section order" type="number" min={0} max={999} value={draft.order} onChange={event => { setDraft({ ...draft, order: Number(event.target.value) }); setDirty(true) }} className="w-20 rounded border px-2 py-1" /></label>}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {definition.fields.map(field => {
                const value = draft.values[field.key] ?? field.value
                return <div key={field.key} className={field.type === "text" && (field.value.length > 100 || /description|paragraph/i.test(field.key)) ? "lg:col-span-2" : ""}>
                  <label htmlFor={`marketing-${field.key}`} className="mb-1 block text-xs font-semibold text-slate-600">{field.label}</label>
                  {field.type === "text" && (field.value.length > 100 || /description|paragraph/i.test(field.key)) ?
                    <textarea id={`marketing-${field.key}`} value={value} onChange={event => setValue(field.key, event.target.value)} rows={3} maxLength={6000} className={inputClass} /> :
                    <input id={`marketing-${field.key}`} value={value} onChange={event => setValue(field.key, event.target.value)} maxLength={field.type === "image" ? 600 : 6000} className={inputClass} />}
                  {field.type === "image" && <div className="mt-2 flex flex-wrap items-center gap-3">
                    {value && <img src={value} alt={`${field.label} preview`} className="h-20 max-w-full rounded border bg-slate-50 object-contain" />}
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs">{uploading === field.key ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}Upload image
                      <input type="file" accept="image/*" disabled={Boolean(uploading)} className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(field.key, file); event.target.value = "" }} />
                    </label>
                  </div>}
                </div>
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button type="button" disabled={saving || Boolean(uploading)} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-lg bg-[#1560bd] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save section</button>
              <button type="button" disabled={saving} onClick={() => {
                if (window.confirm("Restore this section's default copy and visibility? Save to publish.")) { setDraft({ ...defaultMarketingContent(definition), revision: draft.revision }); setDirty(true) }
              }} className="rounded-lg border px-4 py-2 text-sm">Restore defaults</button>
              {dirty && <span role="status" className="text-xs text-amber-700">Unsaved changes</span>}
            </div>
          </>}
        </div>
      </div>
    </section>
    <section aria-labelledby="marketing-tools-heading">
      <h2 id="marketing-tools-heading" className="mb-3 text-lg font-bold text-[#0f2557]">Marketing tools &amp; existing controls</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{TOOLS.map(tool => <Link key={tool.href} href={tool.href} className="rounded-xl border bg-white p-4 hover:border-blue-400">
        <h3 className="text-sm font-bold text-[#1560bd]">{tool.title}</h3><p className="mt-2 text-xs leading-relaxed text-slate-600">{tool.detail}</p>
      </Link>)}</div>
    </section>
  </div>
}
