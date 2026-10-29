"use client"

import { useEffect, useState } from "react"
import { z } from "zod"
import { toast } from "react-hot-toast"
import { apiFetchJson } from "@/lib/api-client"
import { SaraCareConfigSchema, SaraCareRuleSchema, emptySaraCareConfig,
  type SaraCareConfig, type SaraCareRule, type SaraCareYears } from "@/lib/sara-care-types"

const makeRule = (): SaraCareRule => ({ id: crypto.randomUUID(), name: "", scope: "division", productId: "",
  division: "", category: "", segment: "", excluded: false, basis: "price", defaultYears: 1,
  rates: ([1, 2, 3] as SaraCareYears[]).map(years => ({ years, percentage: 0, enabled: true })) })
const ProductOptionsSchema = z.object({ products: z.array(z.object({ id: z.string(), name: z.string(), sku: z.string() })), total: z.number(), nextSkip: z.number().nullable() })
const TaxonomySchema = z.object({ groups: z.array(z.object({ division: z.string(), category: z.string(), segment: z.string(), count: z.number() })) })
type ProductOption = z.infer<typeof ProductOptionsSchema>["products"][number]
type ProductGroup = z.infer<typeof TaxonomySchema>["groups"][number]
const labelKey = (value: string) => value.trim().toLowerCase()
const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"

export default function SaraCareAdminPage() {
  const [config, setConfig] = useState<SaraCareConfig>(emptySaraCareConfig)
  const [form, setForm] = useState<SaraCareRule | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState("")
  const [productTotal, setProductTotal] = useState(0)
  const [productSkip, setProductSkip] = useState(0)
  const [nextProductSkip, setNextProductSkip] = useState<number | null>(null)
  const [productAttempt, setProductAttempt] = useState(0)
  const [previewProduct, setPreviewProduct] = useState("")
  const [preview, setPreview] = useState<{ matchedRule: string | null; options: Array<{ years: number; price: number; percentage: number }> } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState("")
  const [groupsAttempt, setGroupsAttempt] = useState(0)
  const load = async () => {
    setLoading(true); setError("")
    try { setConfig(await apiFetchJson("/api/admin/sara-care", {}, value => SaraCareConfigSchema.parse(value))) }
    catch (error) { setError(error instanceof Error ? error.message : "Could not load Sara Care") }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  useEffect(() => {
    const controller = new AbortController()
    setProductsLoading(true); setProductsError(""); setNextProductSkip(null)
    if (productSkip === 0) setProducts([])
    const timer = setTimeout(() => {
      void apiFetchJson(`/api/admin/sara-care?options=products&skip=${productSkip}&search=${encodeURIComponent(search)}`, { signal: controller.signal }, value => ProductOptionsSchema.parse(value)).then(value => {
        if (controller.signal.aborted) return
        setProducts(previous => productSkip === 0 ? value.products : [...previous, ...value.products.filter(product => !previous.some(item => item.id === product.id))])
        setProductTotal(value.total); setNextProductSkip(value.nextSkip)
      }).catch(error => { if (!controller.signal.aborted) setProductsError(error instanceof Error ? error.message : "Could not load database products") })
        .finally(() => { if (!controller.signal.aborted) setProductsLoading(false) })
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [search, productSkip, productAttempt])
  useEffect(() => {
    const controller = new AbortController()
    setGroupsLoading(true); setGroupsError("")
    void apiFetchJson("/api/admin/sara-care?options=taxonomy", { signal: controller.signal }, value => TaxonomySchema.parse(value)).then(value => {
      if (!controller.signal.aborted) setGroups(value.groups)
    }).catch(error => { if (!controller.signal.aborted) setGroupsError(error instanceof Error ? error.message : "Could not load database groups") })
      .finally(() => { if (!controller.signal.aborted) setGroupsLoading(false) })
    return () => controller.abort()
  }, [groupsAttempt])
  const searchProducts = (value: string) => { setSearch(value); setProductSkip(0) }
  const groupOptions = (field: "division" | "category" | "segment") => {
    const options = new Map<string, { value: string; count: number }>()
    for (const group of groups) {
      if ((field !== "division" && labelKey(group.division) !== labelKey(form?.division || "")) ||
        (field === "segment" && labelKey(group.category) !== labelKey(form?.category || ""))) continue
      const value = group[field]
      if (!value) continue
      const existing = options.get(labelKey(value))
      options.set(labelKey(value), { value: existing?.value || value, count: (existing?.count || 0) + group.count })
    }
    return [...options.values()].sort((a, b) => a.value.localeCompare(b.value))
  }
  const productStatus = <div className="text-sm text-gray-600" aria-live="polite">
    {productsLoading ? "Loading database products…" : productsError ? <span role="alert">{productsError} <button type="button" className="underline" onClick={() => setProductAttempt(attempt => attempt + 1)}>Retry products</button></span> :
      <>{products.length} of {productTotal} matching database products. {!productTotal && "No products found."} {nextProductSkip !== null && <button type="button" className="font-semibold underline" onClick={() => setProductSkip(nextProductSkip)}>Load more products</button>}</>}
  </div>
  const setRule = (patch: Partial<SaraCareRule>) => { setForm(current => current && { ...current, ...patch }); setPreview(null) }
  const addRule = () => {
    const parsed = SaraCareRuleSchema.safeParse(form)
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    const next = { ...config, rules: [...config.rules.filter(rule => rule.id !== parsed.data.id), parsed.data] }
    const checked = SaraCareConfigSchema.safeParse({ ...next, enabled: false })
    if (!checked.success) { toast.error(checked.error.issues[0].message); return }
    setConfig(next); setForm(null); setPreview(null)
    toast.success("Rule added to draft. Save configuration to apply it.")
  }
  const save = async () => {
    if (saving) return
    if (form) { toast.error("Apply or cancel the rule being edited first."); return }
    const parsed = SaraCareConfigSchema.safeParse(config)
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return }
    setSaving(true)
    try {
      setConfig(await apiFetchJson("/api/admin/sara-care", { method: "PUT", json: parsed.data }, value => SaraCareConfigSchema.parse(value)))
      toast.success("Sara Care configuration saved")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save Sara Care") }
    finally { setSaving(false) }
  }
  const showPreview = async () => {
    if (!previewProduct || previewing) return
    setPreviewing(true)
    try {
      const draft = form ? { ...config, rules: [...config.rules.filter(rule => rule.id !== form.id), form] } : config
      const result = await apiFetchJson("/api/admin/sara-care", { method: "POST", json: { config: { ...draft, enabled: false }, productId: previewProduct } })
      setPreview(result as NonNullable<typeof preview>)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not preview Sara Care") }
    finally { setPreviewing(false) }
  }
  if (loading) return <p className="p-6">Loading Sara Care…</p>
  if (error) return <div className="p-6"><p role="alert">{error}</p><button type="button" onClick={() => void load()}>Retry</button></div>
  return <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
    <div><h1 className="text-2xl font-bold">Sara Care</h1><p className="mt-1 text-sm text-gray-600">Optional protection products automatically added to eligible device carts. Customers can change the duration or remove them.</p></div>
    <section className="space-y-4 rounded-xl border bg-white p-5">
      <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={config.enabled} onChange={event => setConfig({ ...config, enabled: event.target.checked })} /> Enable Sara Care</label>
      <label className="block text-sm">Coverage begins<select className={inputClass} value={config.coverageStarts} onChange={event => setConfig({ ...config, coverageStarts: event.target.value as SaraCareConfig["coverageStarts"] })}><option value="delivery">On delivery / collection</option><option value="purchase">On purchase after payment</option></select></label>
      <label className="block text-sm">Coverage terms, exclusions and refund policy<textarea className={inputClass} rows={5} value={config.terms} onChange={event => setConfig({ ...config, terms: event.target.value })} placeholder="Describe what Sara Care covers, its exclusions, how coverage relates to the manufacturer's warranty, and cancellation/refund handling." /></label>
      <p className="text-sm text-gray-600">Prices are upfront package charges inclusive of 18% GST. Each duration has its own total percentage. A 2-year rate is applied once, not multiplied by two. Care is excluded from ordinary device coupons and gift offers.</p>
    </section>
    <section className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Pricing rules</h2><button type="button" disabled={saving} className="rounded-lg bg-maroon-800 px-4 py-2 text-sm text-white" onClick={() => setForm(makeRule())}>Add rule</button></div>
      <p className="my-3 text-sm text-gray-600">Product → segment → category → division. The most specific rule wins. An exclusion blocks broader rules.</p>
      {!config.rules.length && <p className="text-sm text-gray-500">No rules yet. Eligible devices receive Care only after configuration is saved and enabled.</p>}
      <ul className="divide-y">{config.rules.map(rule => <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div><strong>{rule.name}</strong><p className="text-sm text-gray-600">{rule.scope}: {rule.scope === "product" ? rule.productId : [rule.division, rule.category, rule.segment].filter(Boolean).join(" / ")} · {rule.excluded ? "Excluded" : `${rule.basis === "mrp" ? "MRP" : "Selling price"} · ${rule.rates.filter(rate => rate.enabled).map(rate => `${rate.years}Y ${rate.percentage}%`).join(" · ")}`}</p></div>
        <div className="flex gap-3 text-sm"><button type="button" disabled={saving} onClick={() => setForm({ ...rule, rates: rule.rates.map(rate => ({ ...rate })) })}>Edit</button><button type="button" disabled={saving} className="text-red-700" onClick={() => { setConfig({ ...config, rules: config.rules.filter(item => item.id !== rule.id) }); setPreview(null) }}>Remove from draft</button></div>
      </li>)}</ul>
    </section>
    {form && <section className="space-y-4 rounded-xl border border-maroon-200 bg-white p-5">
      <h2 className="font-semibold">Edit rule</h2>
      <label className="block text-sm">Rule name<input className={inputClass} value={form.name} onChange={event => setRule({ name: event.target.value })} /></label>
      <label className="block text-sm">Apply to<select className={inputClass} value={form.scope} onChange={event => {
        const scope = event.target.value as SaraCareRule["scope"]
        setRule({ scope, productId: "", ...(scope === "product" ? { division: "", category: "", segment: "" } : scope === "division" ? { category: "", segment: "" } : scope === "category" ? { segment: "" } : {}) })
      }}>{["division", "category", "segment", "product"].map(scope => <option key={scope} value={scope}>{scope}</option>)}</select></label>
      {form.scope !== "product" && <>
        {groupsError && <p role="alert" className="text-sm text-red-700">{groupsError} <button type="button" className="underline" onClick={() => setGroupsAttempt(attempt => attempt + 1)}>Retry groups</button></p>}
        <div className="grid gap-3 sm:grid-cols-3">{(["division", ...(form.scope !== "division" ? ["category"] : []), ...(form.scope === "segment" ? ["segment"] : [])] as Array<"division" | "category" | "segment">).map(field => {
          const options = groupOptions(field)
          const waitingForParent = field === "category" ? !form.division : field === "segment" ? !form.division || !form.category : false
          return <label key={field} className="text-sm capitalize">{field}
            <select className={inputClass} value={form[field]} disabled={groupsLoading || !!groupsError || waitingForParent} onChange={event => setRule({ [field]: event.target.value, ...(field === "division" ? { category: "", segment: "" } : field === "category" ? { segment: "" } : {}) })}>
              <option value="">{groupsLoading ? "Loading…" : waitingForParent ? `Select ${field === "category" ? "division" : "category"} first` : options.length ? `Select ${field}` : `No ${field} found`}</option>
              {form[field] && !options.some(option => labelKey(option.value) === labelKey(form[field])) && <option value={form[field]}>{form[field]} (saved value; not in database)</option>}
              {options.map(option => <option key={labelKey(option.value)} value={labelKey(option.value) === labelKey(form[field]) ? form[field] : option.value}>{option.value} ({option.count} products)</option>)}
            </select>
          </label>
        })}</div>
        <p className="text-xs text-gray-500">Groups come from database device products, including inactive products. Categories follow the selected division; segments follow the selected category.</p>
      </>}
      {form.scope === "product" && <div className="space-y-2"><label className="block text-sm">Search product<input className={inputClass} value={search} placeholder="Search name or SKU" onChange={event => searchProducts(event.target.value)} /></label><select aria-label="Covered product" className={inputClass} value={form.productId} disabled={productsLoading || !!productsError} onChange={event => setRule({ productId: event.target.value })}><option value="">Select a product</option>{form.productId && !products.some(product => product.id === form.productId) && <option value={form.productId}>{form.productId} (selected product)</option>}{products.map(product => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` · ${product.sku}` : ""}</option>)}</select>{productStatus}</div>}
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={form.excluded} onChange={event => setRule({ excluded: event.target.checked })} /> Exclude this product/group from Sara Care</label>
      {!form.excluded && <><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Price basis<select className={inputClass} value={form.basis} onChange={event => setRule({ basis: event.target.value as SaraCareRule["basis"] })}><option value="price">Selling price before coupons</option><option value="mrp">MRP (unavailable when MRP is missing)</option></select></label><label className="text-sm">Default duration<select className={inputClass} value={form.defaultYears} onChange={event => setRule({ defaultYears: Number(event.target.value) as SaraCareYears })}>{[1, 2, 3].map(years => <option key={years} value={years}>{years} {years === 1 ? "year" : "years"}</option>)}</select></label></div>
        <div className="grid gap-3 sm:grid-cols-3">{form.rates.map(rate => <div key={rate.years} className="rounded-lg border p-3"><label className="flex gap-2 text-sm"><input type="checkbox" checked={rate.enabled} onChange={event => setRule({ rates: form.rates.map(item => item.years === rate.years ? { ...item, enabled: event.target.checked } : item) })} /> {rate.years}-year package</label><label className="mt-2 block text-sm">Percentage<input type="number" min="0" max="100" step="0.01" className={inputClass} value={rate.percentage} onChange={event => setRule({ rates: form.rates.map(item => item.years === rate.years ? { ...item, percentage: Number(event.target.value) } : item) })} /></label></div>)}</div></>}
      <div className="flex gap-3"><button type="button" className="rounded-lg bg-maroon-800 px-4 py-2 text-white" onClick={addRule}>Apply to draft</button><button type="button" onClick={() => setForm(null)}>Cancel edit</button></div>
    </section>}
    <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-semibold">Preview with a product</h2><input aria-label="Search preview product" className={inputClass} placeholder="Search product name" value={search} onChange={event => searchProducts(event.target.value)} /><select aria-label="Preview product" disabled={productsLoading || !!productsError} className={inputClass} value={previewProduct} onChange={event => { setPreviewProduct(event.target.value); setPreview(null) }}><option value="">Select product</option>{previewProduct && !products.some(product => product.id === previewProduct) && <option value={previewProduct}>{previewProduct}</option>}{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select>{productStatus}<button type="button" disabled={!previewProduct || previewing || productsLoading || !!productsError} onClick={() => void showPreview()}>{previewing ? "Calculating…" : "Preview draft prices"}</button>{preview && <div className="text-sm"><p>{preview.matchedRule ? `Matched rule: ${preview.matchedRule}` : "No eligible rule or this product is excluded."}</p>{preview.options.map(option => <p key={option.years}>{option.years} year(s) · {option.percentage}% · ₹{option.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>)}</div>}</section>
    <button type="button" disabled={saving} onClick={() => void save()} className="rounded-lg bg-maroon-800 px-6 py-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save configuration"}</button>
  </div>
}
