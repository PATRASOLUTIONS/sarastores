"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  LayoutGrid,
  Loader2,
  PackageSearch,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react"
import toast from "react-hot-toast"
import { apiFetchJson } from "@/lib/api-client"

type SectionType = "category" | "manual"

interface HomeSection {
  id: string
  type: SectionType
  title: string | null
  config: { categoryId?: string; productIds?: string[] }
  enabled: boolean
  order: number
}

interface Category {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  image?: string
  images?: string[]
  price?: number
  sku?: string
  active?: boolean
}

interface EditorState {
  id?: string
  type: SectionType
  title: string
  categoryId: string
  productIds: string[]
  enabled: boolean
}

const emptyEditor: EditorState = {
  type: "category",
  title: "",
  categoryId: "",
  productIds: [],
  enabled: true,
}

function productImage(product: Product) {
  return product.image || product.images?.[0] || ""
}

export default function HomeComponentsPage() {
  const [sections, setSections] = useState<HomeSection[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [productMap, setProductMap] = useState<Record<string, Product>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [savingEditor, setSavingEditor] = useState(false)

  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category.name])),
    [categories],
  )

  async function loadData() {
    try {
      setLoading(true)
      const [sectionData, categoryData] = await Promise.all([
        apiFetchJson<HomeSection[]>("/api/home-components"),
        apiFetchJson<Category[]>("/api/categories"),
      ])
      const ordered = [...sectionData].sort((a, b) => a.order - b.order)
      setSections(ordered)
      setCategories(categoryData)

      const productIds = [...new Set(ordered.flatMap((section) => section.config.productIds || []))]
      if (productIds.length > 0) {
        const products = await apiFetchJson<Product[]>("/api/products/bulk", {
          method: "POST",
          body: JSON.stringify({ ids: productIds, include_inactive: true }),
        })
        setProductMap(Object.fromEntries(products.map((product) => [product.id, product])))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load homepage sections")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function updateSection(id: string, updates: Partial<HomeSection>, successMessage?: string) {
    setSavingId(id)
    try {
      const updated = await apiFetchJson<HomeSection>("/api/home-components", {
        method: "PUT",
        body: JSON.stringify({ id, ...updates }),
      })
      setSections((current) => current.map((section) => (section.id === id ? updated : section)))
      if (successMessage) toast.success(successMessage)
      return updated
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update section")
      return null
    } finally {
      setSavingId(null)
    }
  }

  async function moveSection(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sections.length) return
    const current = sections[index]
    const target = sections[targetIndex]
    const next = [...sections]
    next[index] = target
    next[targetIndex] = current
    const normalized = next.map((section, order) => ({ ...section, order }))
    setSections(normalized)

    setSavingId(current.id)
    try {
      await Promise.all(
        normalized.map((section) => apiFetchJson("/api/home-components", {
          method: "PUT",
          body: JSON.stringify({ id: section.id, order: section.order }),
        })),
      )
    } catch (error) {
      setSections(sections)
      toast.error(error instanceof Error ? error.message : "Could not reorder sections")
    } finally {
      setSavingId(null)
    }
  }

  async function duplicateSection(section: HomeSection) {
    setSavingId(section.id)
    try {
      await apiFetchJson("/api/home-components", {
        method: "POST",
        body: JSON.stringify({
          type: section.type,
          title: section.title ? `${section.title} copy` : "",
          config: section.config,
          enabled: false,
        }),
      })
      toast.success("Draft copy created")
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate section")
    } finally {
      setSavingId(null)
    }
  }

  async function deleteSection(section: HomeSection) {
    if (!window.confirm(`Delete ${section.title || "this homepage section"}?`)) return
    setSavingId(section.id)
    try {
      await apiFetchJson(`/api/home-components?id=${encodeURIComponent(section.id)}`, { method: "DELETE" })
      setSections((current) => current.filter((item) => item.id !== section.id))
      toast.success("Section deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete section")
    } finally {
      setSavingId(null)
    }
  }

  function openEditor(section?: HomeSection) {
    setQuery("")
    setResults([])
    setEditor(
      section
        ? {
            id: section.id,
            type: section.type,
            title: section.title || "",
            categoryId: section.config.categoryId || "",
            productIds: section.config.productIds || [],
            enabled: section.enabled,
          }
        : { ...emptyEditor, productIds: [] },
    )
  }

  useEffect(() => {
    if (!editor || editor.type !== "manual" || query.trim().length < 2) {
      setResults([])
      return
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearching(true)
        const products = await apiFetchJson<Product[]>(
          `/api/products?search=${encodeURIComponent(query.trim())}&fields=card&include_inactive=true`,
        )
        setResults(products)
        setProductMap((current) => ({
          ...current,
          ...Object.fromEntries(products.map((product) => [product.id, product])),
        }))
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Product search failed")
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => window.clearTimeout(timer)
  }, [editor?.type, query])

  function moveProduct(index: number, direction: -1 | 1) {
    if (!editor) return
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= editor.productIds.length) return
    const ids = [...editor.productIds]
    ;[ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]]
    setEditor({ ...editor, productIds: ids })
  }

  async function saveEditor() {
    if (!editor) return
    if (editor.type === "category" && !editor.categoryId) {
      toast.error("Choose a category")
      return
    }
    if (editor.type === "manual" && !editor.title.trim()) {
      toast.error("Add a section title")
      return
    }
    if (editor.type === "manual" && editor.productIds.length === 0) {
      toast.error("Select at least one product")
      return
    }

    setSavingEditor(true)
    try {
      const payload = {
        ...(editor.id ? { id: editor.id } : {}),
        type: editor.type,
        title: editor.title.trim(),
        config:
          editor.type === "category"
            ? { categoryId: editor.categoryId }
            : { productIds: editor.productIds },
        enabled: editor.enabled,
      }
      await apiFetchJson("/api/home-components", {
        method: editor.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      })
      toast.success(editor.id ? "Section updated" : "Section created")
      setEditor(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save section")
    } finally {
      setSavingEditor(false)
    }
  }

  const liveCount = sections.filter((section) => section.enabled).length
  const manualCount = sections.filter((section) => section.type === "manual").length

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-7 flex flex-col gap-5 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-600">
              <LayoutGrid className="h-4 w-4" />
              Storefront merchandising
            </div>
            <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">Homepage sections</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Arrange category rails and hand-picked product collections shown on the storefront.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openEditor()}
            className="inline-flex h-11 items-center justify-center gap-2 bg-[#0f2557] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#173773]"
          >
            <Plus className="h-4 w-4" />
            Add section
          </button>
        </header>

        <section className="mb-6 grid grid-cols-3 border border-slate-200 bg-white shadow-sm">
          <div className="border-r border-slate-200 px-4 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase text-slate-500">Sections</p>
            <p className="mt-1 text-2xl font-bold">{sections.length}</p>
          </div>
          <div className="border-r border-slate-200 px-4 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase text-slate-500">Live</p>
            <p className="mt-1 text-2xl font-bold text-emerald-700">{liveCount}</p>
          </div>
          <div className="px-4 py-4 sm:px-6">
            <p className="text-xs font-semibold uppercase text-slate-500">Curated</p>
            <p className="mt-1 text-2xl font-bold text-orange-600">{manualCount}</p>
          </div>
        </section>

        {loading ? (
          <div className="flex min-h-72 items-center justify-center border border-slate-200 bg-white">
            <Loader2 className="h-7 w-7 animate-spin text-[#0f2557]" />
          </div>
        ) : sections.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-6 text-center">
            <LayoutGrid className="h-10 w-10 text-slate-300" />
            <h2 className="mt-4 text-lg font-bold">No homepage sections</h2>
            <p className="mt-1 text-sm text-slate-500">Create a category rail or curate a product collection.</p>
            <button onClick={() => openEditor()} className="mt-5 inline-flex items-center gap-2 bg-[#0f2557] px-4 py-2.5 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Add first section
            </button>
          </div>
        ) : (
          <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[56px_minmax(260px,1.3fr)_minmax(220px,1fr)_120px_180px] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase text-slate-500 lg:grid">
              <span>Order</span>
              <span>Section</span>
              <span>Contents</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {sections.map((section, index) => {
              const productIds = section.config.productIds || []
              const busy = savingId === section.id
              return (
                <article
                  key={section.id}
                  className={`grid gap-4 border-b border-slate-100 p-4 last:border-b-0 lg:grid-cols-[56px_minmax(260px,1.3fr)_minmax(220px,1fr)_120px_180px] lg:items-center ${
                    section.enabled ? "" : "bg-slate-50/80"
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <GripVertical className="hidden h-5 w-5 text-slate-300 lg:block" />
                    <span className="w-6 text-center text-sm font-bold text-slate-500">{index + 1}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${section.type === "category" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}>
                        {section.type === "category" ? <LayoutGrid className="h-5 w-5" /> : <PackageSearch className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-bold sm:text-base">
                          {section.title || categoryNames[section.config.categoryId || ""] || "Untitled category"}
                        </h2>
                        <p className="mt-0.5 text-xs font-medium capitalize text-slate-500">{section.type} section</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    {section.type === "category" ? (
                      <p className="truncate text-sm text-slate-600">
                        Category: <span className="font-semibold text-slate-900">{categoryNames[section.config.categoryId || ""] || "Missing category"}</span>
                      </p>
                    ) : (
                      <div>
                        <div className="flex -space-x-2">
                          {productIds.slice(0, 5).map((id) => {
                            const product = productMap[id]
                            return productImage(product || { id, name: "" }) ? (
                              <img key={id} src={productImage(product)} alt="" className="h-9 w-9 border-2 border-white bg-slate-100 object-cover" />
                            ) : (
                              <span key={id} className="flex h-9 w-9 items-center justify-center border-2 border-white bg-slate-100"><ImageIcon className="h-4 w-4 text-slate-400" /></span>
                            )
                          })}
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-500">{productIds.length} product{productIds.length === 1 ? "" : "s"}</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void updateSection(section.id, { enabled: !section.enabled }, section.enabled ? "Section hidden" : "Section is live")}
                    className={`inline-flex w-fit items-center gap-2 px-3 py-2 text-xs font-bold ${section.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : section.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {section.enabled ? "Live" : "Hidden"}
                  </button>

                  <div className="flex items-center gap-1 lg:justify-end">
                    <button type="button" title="Move up" disabled={index === 0 || busy} onClick={() => void moveSection(index, -1)} className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" title="Move down" disabled={index === sections.length - 1 || busy} onClick={() => void moveSection(index, 1)} className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                    <button type="button" title="Duplicate" disabled={busy} onClick={() => void duplicateSection(section)} className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"><Copy className="h-4 w-4" /></button>
                    <button type="button" title="Edit" disabled={busy} onClick={() => openEditor(section)} className="flex h-9 w-9 items-center justify-center text-[#0f2557] hover:bg-blue-50 disabled:opacity-30"><Pencil className="h-4 w-4" /></button>
                    <button type="button" title="Delete" disabled={busy} onClick={() => void deleteSection(section)} className="flex h-9 w-9 items-center justify-center text-red-600 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
          <div role="dialog" aria-modal="true" aria-labelledby="section-editor-title" className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl sm:max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-bold uppercase text-orange-600">Homepage merchandising</p>
                <h2 id="section-editor-title" className="mt-1 text-xl font-bold">{editor.id ? "Edit section" : "Add section"}</h2>
              </div>
              <button type="button" title="Close" onClick={() => setEditor(null)} className="flex h-10 w-10 items-center justify-center text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditor({ ...editor, type: "category" })}
                  className={`flex items-center gap-3 border p-4 text-left ${editor.type === "category" ? "border-[#0f2557] bg-blue-50 text-[#0f2557]" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <LayoutGrid className="h-5 w-5 shrink-0" />
                  <span><strong className="block text-sm">Category rail</strong><span className="hidden text-xs text-slate-500 sm:block">Products update with the category</span></span>
                  {editor.type === "category" && <Check className="ml-auto h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setEditor({ ...editor, type: "manual" })}
                  className={`flex items-center gap-3 border p-4 text-left ${editor.type === "manual" ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-200 hover:bg-slate-50"}`}
                >
                  <PackageSearch className="h-5 w-5 shrink-0" />
                  <span><strong className="block text-sm">Curated products</strong><span className="hidden text-xs text-slate-500 sm:block">Pick and arrange individual items</span></span>
                  {editor.type === "manual" && <Check className="ml-auto h-4 w-4" />}
                </button>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Section title {editor.type === "category" && <span className="font-normal text-slate-400">(optional)</span>}</span>
                  <input value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} maxLength={80} placeholder={editor.type === "category" ? "Use category name" : "e.g. Staff picks"} className="h-11 w-full border border-slate-300 px-3 text-sm outline-none focus:border-[#0f2557] focus:ring-1 focus:ring-[#0f2557]" />
                </label>
                <label className="flex items-end">
                  <button type="button" onClick={() => setEditor({ ...editor, enabled: !editor.enabled })} className={`flex h-11 w-full items-center justify-between border px-3 text-sm font-semibold ${editor.enabled ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-50 text-slate-600"}`}>
                    <span className="flex items-center gap-2">{editor.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}{editor.enabled ? "Publish immediately" : "Save as hidden"}</span>
                    <span className={`h-5 w-9 p-0.5 ${editor.enabled ? "bg-emerald-600" : "bg-slate-300"}`}><span className={`block h-4 w-4 bg-white transition-transform ${editor.enabled ? "translate-x-4" : ""}`} /></span>
                  </button>
                </label>
              </div>

              {editor.type === "category" ? (
                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-bold">Category</span>
                  <select value={editor.categoryId} onChange={(event) => setEditor({ ...editor, categoryId: event.target.value })} className="h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#0f2557] focus:ring-1 focus:ring-[#0f2557]">
                    <option value="">Choose a category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
              ) : (
                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <section>
                    <label className="mb-2 block text-sm font-bold">Find products</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by product name" className="h-11 w-full border border-slate-300 pl-10 pr-10 text-sm outline-none focus:border-[#0f2557] focus:ring-1 focus:ring-[#0f2557]" />
                      {searching && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-slate-500" />}
                    </div>
                    <div className="mt-2 max-h-72 overflow-y-auto border border-slate-200">
                      {query.trim().length < 2 ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">Type at least two characters to search.</p>
                      ) : results.length === 0 && !searching ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">No matching products.</p>
                      ) : results.map((product) => {
                        const selected = editor.productIds.includes(product.id)
                        return (
                          <button key={product.id} type="button" disabled={selected} onClick={() => setEditor({ ...editor, productIds: [...editor.productIds, product.id] })} className="flex w-full items-center gap-3 border-b border-slate-100 p-3 text-left last:border-b-0 hover:bg-slate-50 disabled:bg-emerald-50">
                            {productImage(product) ? <img src={productImage(product)} alt="" className="h-10 w-10 bg-white object-contain" /> : <span className="flex h-10 w-10 items-center justify-center bg-slate-100"><ImageIcon className="h-4 w-4 text-slate-400" /></span>}
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{product.name}</span><span className="text-xs text-slate-500">{product.sku || "No SKU"}</span></span>
                            {selected ? <Check className="h-4 w-4 text-emerald-600" /> : <Plus className="h-4 w-4 text-[#0f2557]" />}
                          </button>
                        )
                      })}
                    </div>
                  </section>

                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-bold">Selected products</p>
                      <span className="text-xs font-semibold text-slate-500">{editor.productIds.length}/30</span>
                    </div>
                    <div className="max-h-[326px] overflow-y-auto border border-slate-200">
                      {editor.productIds.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-500">Products appear here in storefront order.</p>
                      ) : editor.productIds.map((id, index) => {
                        const product = productMap[id]
                        return (
                          <div key={id} className="flex items-center gap-2 border-b border-slate-100 p-2 last:border-b-0">
                            <span className="w-5 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                            {product && productImage(product) ? <img src={productImage(product)} alt="" className="h-9 w-9 bg-white object-contain" /> : <span className="flex h-9 w-9 items-center justify-center bg-slate-100"><ImageIcon className="h-4 w-4 text-slate-400" /></span>}
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{product?.name || "Product unavailable"}</span>
                            <button type="button" title="Move up" disabled={index === 0} onClick={() => moveProduct(index, -1)} className="p-1.5 text-slate-500 disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
                            <button type="button" title="Move down" disabled={index === editor.productIds.length - 1} onClick={() => moveProduct(index, 1)} className="p-1.5 text-slate-500 disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
                            <button type="button" title="Remove" onClick={() => setEditor({ ...editor, productIds: editor.productIds.filter((productId) => productId !== id) })} className="p-1.5 text-red-500"><X className="h-4 w-4" /></button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
              <button type="button" onClick={() => setEditor(null)} className="h-10 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-200">Cancel</button>
              <button type="button" disabled={savingEditor} onClick={() => void saveEditor()} className="inline-flex h-10 items-center gap-2 bg-[#0f2557] px-5 text-sm font-semibold text-white disabled:opacity-60">
                {savingEditor ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                {editor.id ? "Save changes" : "Create section"}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
