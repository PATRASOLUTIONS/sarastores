"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import CategoryGlyph from "@/components/CategoryGlyph"
import {
  Boxes,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  FolderTree,
  Globe2,
  ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"

export type CatalogueTab = "categories" | "subcategories" | "brands"

interface Category {
  id: string
  name: string
  description?: string
  image?: string
  icon?: string
  isEnabled?: boolean
}

interface SubCategory {
  id: string
  name: string
  image?: string
  categoryId?: string
  active?: boolean
}

interface Brand {
  _id: string
  name: string
  slug: string
  tagline?: string
  logo?: string
  enabled?: boolean
  landingPageEnabled?: boolean
}

type Editor =
  | { kind: "category"; id?: string; name: string; description: string; image: string; icon: string; enabled: boolean }
  | { kind: "subcategory"; id?: string; name: string; image: string; categoryId: string; enabled: boolean }
  | { kind: "brand"; id?: string; name: string; slug: string; tagline: string; logo: string; enabled: boolean; landingPageEnabled: boolean }

const TABS: { id: CatalogueTab; label: string; icon: typeof FolderTree }[] = [
  { id: "categories", label: "Categories", icon: FolderTree },
  { id: "subcategories", label: "Sub-categories", icon: Boxes },
  { id: "brands", label: "Brands", icon: Tags },
]

const slugify = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, "")
  .trim()
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-")

function ItemVisual({ image, icon, name }: { image?: string; icon?: string; name: string }) {
  const value = image || icon
  const isImage = value?.startsWith("http") || value?.startsWith("data:") || value?.startsWith("/")

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-50">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="h-full w-full object-cover" />
      ) : (
        <CategoryGlyph label={name} className="h-6 w-6 text-black" />
      )}
    </div>
  )
}

export default function CatalogueManager({ initialTab }: { initialTab: CatalogueTab }) {
  const router = useRouter()
  const [tab, setTab] = useState<CatalogueTab>(initialTab)
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<SubCategory[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [categoryResponse, subcategoryResponse, brandResponse] = await Promise.all([
        apiFetch("/api/categories"),
        apiFetch("/api/sub-categories"),
        apiFetch("/api/brands"),
      ])
      if (!categoryResponse.ok || !subcategoryResponse.ok || !brandResponse.ok) {
        throw new Error("One or more catalogue lists could not be loaded")
      }
      const [categoryData, subcategoryData, brandData] = await Promise.all([
        categoryResponse.json(),
        subcategoryResponse.json(),
        brandResponse.json(),
      ])
      setCategories(Array.isArray(categoryData) ? categoryData : [])
      setSubcategories(Array.isArray(subcategoryData) ? subcategoryData : [])
      setBrands(Array.isArray(brandData?.brands) ? brandData.brands : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load catalogue")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const changeTab = (next: CatalogueTab) => {
    setTab(next)
    setQuery("")
    setStatus("all")
    router.replace(`/admin/catalogue?tab=${next}`, { scroll: false })
  }

  const activeOf = (item: Category | SubCategory | Brand) => {
    if ("_id" in item) return (item as Brand).enabled !== false
    if ("active" in item) return (item as SubCategory).active !== false
    return (item as Category).isEnabled !== false
  }

  const items = useMemo(() => {
    const source: (Category | SubCategory | Brand)[] = tab === "categories"
      ? categories
      : tab === "subcategories"
        ? subcategories
        : brands
    const needle = query.trim().toLowerCase()
    return source.filter((item) => {
      const searchable = `${item.name} ${"slug" in item ? item.slug : ""}`.toLowerCase()
      const active = activeOf(item)
      return (!needle || searchable.includes(needle)) && (status === "all" || active === (status === "active"))
    })
  }, [brands, categories, query, status, subcategories, tab])

  const counts = {
    categories: categories.length,
    subcategories: subcategories.length,
    brands: brands.length,
  }

  const openCreate = () => {
    if (tab === "categories") {
      setEditor({ kind: "category", name: "", description: "", image: "", icon: "", enabled: true })
    } else if (tab === "subcategories") {
      setEditor({ kind: "subcategory", name: "", image: "", categoryId: "", enabled: true })
    } else {
      setEditor({ kind: "brand", name: "", slug: "", tagline: "", logo: "", enabled: true, landingPageEnabled: false })
    }
  }

  const openEdit = (item: Category | SubCategory | Brand) => {
    if (tab === "categories") {
      const category = item as Category
      setEditor({ kind: "category", id: category.id, name: category.name, description: category.description || "", image: category.image || "", icon: category.icon || "", enabled: category.isEnabled !== false })
    } else if (tab === "subcategories") {
      const subcategory = item as SubCategory
      setEditor({ kind: "subcategory", id: subcategory.id, name: subcategory.name, image: subcategory.image || "", categoryId: subcategory.categoryId || "", enabled: subcategory.active !== false })
    } else {
      const brand = item as Brand
      setEditor({ kind: "brand", id: brand._id, name: brand.name, slug: brand.slug, tagline: brand.tagline || "", logo: brand.logo || "", enabled: brand.enabled !== false, landingPageEnabled: brand.landingPageEnabled !== false })
    }
  }

  const saveEditor = async () => {
    if (!editor?.name.trim()) {
      toast.error("Name is required")
      return
    }
    if (editor.kind === "brand" && !editor.slug) {
      toast.error("Brand URL slug is required")
      return
    }

    setSaving(true)
    try {
      let response: Response
      if (editor.kind === "category") {
        response = await apiFetch(editor.id ? `/api/categories/${editor.id}` : "/api/categories", {
          method: editor.id ? "PUT" : "POST",
          json: { name: editor.name, description: editor.description, image: editor.image, icon: editor.icon, isEnabled: editor.enabled },
        })
      } else if (editor.kind === "subcategory") {
        response = await apiFetch(editor.id ? `/api/sub-categories/${editor.id}` : "/api/sub-categories", {
          method: editor.id ? "PUT" : "POST",
          json: { name: editor.name, image: editor.image, categoryId: editor.categoryId, active: editor.enabled },
        })
      } else {
        response = await apiFetch("/api/brands", {
          method: editor.id ? "PATCH" : "POST",
          json: editor.id
            ? { id: editor.id, name: editor.name, slug: editor.slug, tagline: editor.tagline, logo: editor.logo, enabled: editor.enabled, landingPageEnabled: editor.landingPageEnabled }
            : { name: editor.name, slug: editor.slug, tagline: editor.tagline, logo: editor.logo, enabled: editor.enabled, landingPageEnabled: editor.landingPageEnabled },
        })
      }

      const result = await response.json()
      if (!response.ok || result?.success === false) throw new Error(result?.error || result?.message || "Could not save")

      const newBrandId = editor.kind === "brand" && !editor.id ? String(result.brandId || "") : ""
      const openLandingEditor = editor.kind === "brand" && editor.landingPageEnabled
      const existingBrandId = editor.kind === "brand" ? editor.id : undefined
      toast.success(`${editor.kind === "subcategory" ? "Sub-category" : editor.kind[0].toUpperCase() + editor.kind.slice(1)} saved`)
      setEditor(null)
      await load()
      if (openLandingEditor && (newBrandId || existingBrandId)) {
        router.push(`/admin/brands/${newBrandId || existingBrandId}`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save")
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (item: Category | SubCategory | Brand) => {
    try {
      if (tab === "categories") {
        const category = item as Category
        await apiFetch(`/api/categories/${category.id}`, { method: "PUT", json: { ...category, isEnabled: !activeOf(category) } })
      } else if (tab === "subcategories") {
        const subcategory = item as SubCategory
        await apiFetch(`/api/sub-categories/${subcategory.id}`, { method: "PUT", json: { ...subcategory, active: !activeOf(subcategory) } })
      } else {
        const brand = item as Brand
        await apiFetch("/api/brands", { method: "PATCH", json: { id: brand._id, enabled: !activeOf(brand) } })
      }
      await load()
    } catch {
      toast.error("Could not update filter visibility")
    }
  }

  const removeItem = async (item: Category | SubCategory | Brand) => {
    if (!confirm(`Delete “${item.name}”?`)) return
    try {
      const url = tab === "categories"
        ? `/api/categories/${(item as Category).id}`
        : tab === "subcategories"
          ? `/api/sub-categories/${(item as SubCategory).id}`
          : `/api/brands?id=${encodeURIComponent((item as Brand)._id)}`
      const response = await apiFetch(url, { method: "DELETE" })
      if (!response.ok) throw new Error()
      toast.success("Deleted")
      await load()
    } catch {
      toast.error("Could not delete item")
    }
  }

  const createBrandPage = async (brand: Brand) => {
    try {
      const response = await apiFetch("/api/brands", { method: "PATCH", json: { id: brand._id, landingPageEnabled: true } })
      if (!response.ok) throw new Error()
      router.push(`/admin/brands/${brand._id}`)
    } catch {
      toast.error("Could not create brand page")
    }
  }

  const categoryName = (id?: string) => categories.find((category) => category.id === id)?.name || "Unassigned"
  const singular = tab === "categories" ? "Category" : tab === "subcategories" ? "Sub-category" : "Brand"

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <p className="text-xs font-bold uppercase text-gray-500">Catalogue</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-950">Taxonomy & brands</h1>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800">
          <Plus className="h-4 w-4" /> Add {singular}
        </button>
      </header>

      <nav className="grid grid-cols-3 border-b border-gray-200" aria-label="Catalogue sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => changeTab(id)} className={`flex min-w-0 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${tab === id ? "border-orange-500 text-gray-950" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
            <Icon className="hidden h-4 w-4 shrink-0 sm:block" />
            <span className="sm:hidden">{id === "subcategories" ? "Sub-cats" : label}</span>
            <span className="hidden sm:inline">{label}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{counts[id]}</span>
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${tab}...`} className="h-10 w-full rounded-md border border-gray-300 pl-9 pr-3 text-sm focus:border-gray-500 focus:outline-none" />
        </label>
        <div className="flex rounded-md border border-gray-300 p-1">
          {(["all", "active", "inactive"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded px-3 py-1.5 text-xs font-semibold capitalize ${status === value ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>{value}</button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden border-y border-gray-200 bg-white">
        <div className="hidden grid-cols-[minmax(240px,1.3fr)_minmax(180px,1fr)_140px_210px] gap-4 bg-gray-50 px-4 py-2 text-xs font-bold uppercase text-gray-500 md:grid">
          <span>Name</span><span>Classification</span><span>Filter status</span><span className="text-right">Actions</span>
        </div>
        {loading ? (
          <div className="flex h-52 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Loading catalogue...</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center"><p className="font-semibold text-gray-800">No matching {tab}</p><p className="mt-1 text-sm text-gray-500">Change the filters or add a new item.</p></div>
        ) : items.map((item) => {
          const active = activeOf(item)
          const brand = tab === "brands" ? item as Brand : null
          const subcategory = tab === "subcategories" ? item as SubCategory : null
          const category = tab === "categories" ? item as Category : null
          const id = brand?._id || subcategory?.id || category?.id
          return (
            <div key={id} className="grid gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(240px,1.3fr)_minmax(180px,1fr)_140px_210px] md:items-center md:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <ItemVisual image={brand?.logo || subcategory?.image || category?.image} icon={category?.icon} name={item.name} />
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-950">{item.name}</p><p className="truncate text-xs text-gray-500">{brand?.tagline || category?.description || (brand ? `/brands/${brand.slug}` : "Used in catalogue filters")}</p></div>
              </div>
              <div className="text-sm text-gray-600">
                {subcategory ? <span className="inline-flex rounded bg-gray-100 px-2 py-1 text-xs font-medium">{categoryName(subcategory.categoryId)}</span> : brand ? <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${brand.landingPageEnabled !== false ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}><Globe2 className="h-3 w-3" />{brand.landingPageEnabled !== false ? "Landing page" : "Filter only"}</span> : <span className="text-xs">Top-level category</span>}
              </div>
              <button type="button" onClick={() => toggle(item)} className={`inline-flex w-fit items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold ${active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                {active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{active ? "In filters" : "Hidden"}
              </button>
              <div className="flex items-center justify-start gap-1 md:justify-end">
                {brand && brand.landingPageEnabled === false && <button type="button" onClick={() => createBrandPage(brand)} className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Globe2 className="h-4 w-4" /> Create page</button>}
                {brand && brand.landingPageEnabled !== false && <a href={`/brands/${brand.slug}`} target="_blank" rel="noreferrer" title="View brand page" className="rounded-md border border-gray-200 p-2 text-gray-600 hover:bg-gray-50"><ExternalLink className="h-4 w-4" /></a>}
                <button type="button" title="Edit" onClick={() => openEdit(item)} className="rounded-md border border-gray-200 p-2 text-gray-700 hover:bg-gray-50"><Pencil className="h-4 w-4" /></button>
                <button type="button" title="Delete" onClick={() => removeItem(item)} className="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          )
        })}
      </section>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`${editor.id ? "Edit" : "Add"} ${editor.kind}`}>
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-bold text-gray-950">{editor.id ? "Edit" : "Add"} {editor.kind === "subcategory" ? "sub-category" : editor.kind}</h2>
              <button type="button" title="Close" onClick={() => setEditor(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block text-sm font-semibold text-gray-700">Name *<input autoFocus value={editor.name} onChange={(event) => {
                const name = event.target.value
                setEditor(editor.kind === "brand" && !editor.id ? { ...editor, name, slug: slugify(name) } : { ...editor, name })
              }} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 font-normal" /></label>

              {editor.kind === "category" && <>
                <label className="block text-sm font-semibold text-gray-700">Description<textarea value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-normal" /></label>
                <div className="grid gap-3 sm:grid-cols-[100px_1fr]"><label className="block text-sm font-semibold text-gray-700">Icon<input value={editor.icon} onChange={(event) => setEditor({ ...editor, icon: event.target.value })} placeholder="📺" className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-center text-xl font-normal" /></label><label className="block text-sm font-semibold text-gray-700">Image URL<input value={editor.image} onChange={(event) => setEditor({ ...editor, image: event.target.value })} placeholder="https://..." className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 font-normal" /></label></div>
              </>}

              {editor.kind === "subcategory" && <>
                <label className="block text-sm font-semibold text-gray-700">Parent category<select value={editor.categoryId} onChange={(event) => setEditor({ ...editor, categoryId: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 font-normal"><option value="">Unassigned</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label className="block text-sm font-semibold text-gray-700">Image URL<input value={editor.image} onChange={(event) => setEditor({ ...editor, image: event.target.value })} placeholder="https://… (leave blank to use the auto icon)" className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 font-normal" /></label>
              </>}

              {editor.kind === "brand" && <>
                <label className="block text-sm font-semibold text-gray-700">URL slug *<div className="mt-1 flex h-10 items-center rounded-md border border-gray-300"><span className="pl-3 text-sm text-gray-400">/brands/</span><input value={editor.slug} onChange={(event) => setEditor({ ...editor, slug: slugify(event.target.value) })} className="h-full min-w-0 flex-1 px-1 text-sm font-normal outline-none" /></div></label>
                <label className="block text-sm font-semibold text-gray-700">Tagline<input value={editor.tagline} onChange={(event) => setEditor({ ...editor, tagline: event.target.value })} className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 font-normal" /></label>
                <label className="block text-sm font-semibold text-gray-700">Logo URL<input value={editor.logo} onChange={(event) => setEditor({ ...editor, logo: event.target.value })} placeholder="https://..." className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 font-normal" /></label>
                <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3"><input type="checkbox" checked={editor.landingPageEnabled} onChange={(event) => setEditor({ ...editor, landingPageEnabled: event.target.checked })} className="mt-0.5 h-4 w-4" /><span><span className="block text-sm font-semibold text-gray-800">Create a separate brand page</span><span className="block text-xs text-gray-500">Opens the page builder after saving. Leave off to use this brand only in filters.</span></span></label>
              </>}

              <label className="flex items-center gap-3 border-t border-gray-100 pt-4"><input type="checkbox" checked={editor.enabled} onChange={(event) => setEditor({ ...editor, enabled: event.target.checked })} className="h-4 w-4" /><span className="text-sm font-semibold text-gray-700">Available in storefront filters</span></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4"><button type="button" onClick={() => setEditor(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Cancel</button><button type="button" onClick={saveEditor} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-gray-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save</button></div>
          </div>
        </div>
      )}
    </div>
  )
}