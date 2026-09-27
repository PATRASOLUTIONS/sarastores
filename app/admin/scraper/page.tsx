"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Package,
  Search,
  Star,
} from "lucide-react"
import { toast } from "react-hot-toast"
import { apiFetch } from "@/lib/api-client"
import SelectWithAdd from "@/components/admin/SelectWithAdd"
import { SAP_OWNED_FIELDS, SCRAPER_LABELS, type ScraperSource } from "@/lib/scrapers/types"

interface ScrapedProduct {
  source: ScraperSource
  sourceUrl: string
  externalId: string | null
  sap: {
    sku: string
    name: string
    category: string
    subCategory: string
    brand: string
    charDesc: string
    price: number | null
  }
  mrp: number | null
  description: string
  images: string[]
  features: string[]
  technicalDetails: Record<string, string>
  manufacturerInfo: string
  manufacturerImages: string[]
  whatsIncluded: string[]
  warranty: string
  rating: number | null
  reviewCount: number | null
  inStock: boolean
  reviews: { rating: number | null; title: string; text: string }[]
}

type Step = "fetch" | "review" | "done"

const SOURCE_HINTS: { source: ScraperSource; example: string }[] = [
  { source: "amazon", example: "amzn.in/d/… or amazon.in/dp/…" },
  { source: "flipkart", example: "dl.flipkart.com/s/… or flipkart.com/…" },
  { source: "pai", example: "paiinternational.in/product-details/…" },
  { source: "lg", example: "lg.com/in/…" },
  { source: "reliance", example: "reliancedigital.in/product/…" },
  { source: "vijaysales", example: "vijaysales.com/p/…" },
  { source: "bosch", example: "bosch-home.in/en/product/…" },
]

function detectSource(url: string): ScraperSource | null {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase().replace(/^www\./, "")
    if (/(^|\.)(amazon\.(in|com)|amzn\.(in|to))$/.test(host)) return "amazon"
    if (/(^|\.)(flipkart\.com|fkrt\.it)$/.test(host)) return "flipkart"
    if (/(^|\.)paiinternational\.in$/.test(host)) return "pai"
    if (/(^|\.)lg\.com$/.test(host)) return "lg"
    if (/(^|\.)reliancedigital\.in$/.test(host)) return "reliance"
    if (/(^|\.)vijaysales\.com$/.test(host)) return "vijaysales"
    if (/(^|\.)bosch-home\.in$/.test(host)) return "bosch"
  } catch {
    /* not a URL yet */
  }
  return null
}

/** Amazon keeps its own tuned endpoint; everything else goes through /api/scrape. */
function normaliseAmazon(raw: any, url: string): ScrapedProduct {
  return {
    source: "amazon",
    sourceUrl: url,
    externalId: raw?.asin ?? null,
    sap: {
      sku: "",
      name: raw?.name ?? "",
      category: raw?.category ?? "",
      subCategory: raw?.subCategory ?? "",
      brand: raw?.brand ?? "",
      charDesc: "",
      price: raw?.price ?? null,
    },
    mrp: raw?.mrp ?? null,
    description: raw?.description ?? "",
    images: raw?.images ?? [],
    features: raw?.features ?? [],
    technicalDetails: raw?.technicalDetails ?? raw?.specifications ?? {},
    manufacturerInfo: raw?.manufacturerInfo ?? "",
    manufacturerImages: raw?.manufacturerImages ?? [],
    whatsIncluded: raw?.whatsIncluded ?? [],
    warranty: raw?.warranty ?? "",
    rating: raw?.rating ?? null,
    reviewCount: raw?.reviewCount ?? null,
    inStock: (raw?.stock ?? 0) > 0,
    reviews: Array.isArray(raw?.reviewsSummary?.customerReviews)
      ? raw.reviewsSummary.customerReviews
      : [],
  }
}

interface Taxonomy {
  brands: string[]
  categories: string[]
  subCategories: string[]
  charDescs: string[]
}

function Panel({
  title,
  count,
  subtitle,
  children,
}: {
  title: string
  count: number
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
          {title}
          {count > 0 && <span className="ml-2 font-normal normal-case text-gray-500">({count})</span>}
        </h2>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Empty({ source, what }: { source: ScraperSource; what: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>
        {SCRAPER_LABELS[source]} did not publish {what}. Add it on the Specifications page after
        saving.
      </span>
    </p>
  )
}

export default function AdminScraperPage() {
  const [sku, setSku] = useState("")
  const [url, setUrl] = useState("")
  const [step, setStep] = useState<Step>("fetch")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null)
  const [product, setProduct] = useState<ScrapedProduct | null>(null)
  const [savedSlug, setSavedSlug] = useState<string | null>(null)
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({
    brands: [],
    categories: [],
    subCategories: [],
    charDescs: [],
  })

  const loadTaxonomy = () =>
    apiFetch("/api/admin/taxonomy")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) {
          setTaxonomy({
            brands: d.brands ?? [],
            categories: d.categories ?? [],
            subCategories: d.subCategories ?? [],
            charDescs: d.charDescs ?? [],
          })
        }
      })
      .catch(() => {
        /* the dropdowns still work with whatever the scrape suggested */
      })

  useEffect(() => {
    loadTaxonomy()
  }, [])

  const source = useMemo(() => detectSource(url), [url])

  const handleFetch = async () => {
    if (!sku.trim()) {
      toast.error("Enter the SAP item number first")
      return
    }
    if (!source) {
      toast.error("That link is not from a supported source")
      return
    }

    setBusy(true)
    setError(null)
    setProduct(null)
    try {
      const endpoint = source === "amazon" ? "/api/scrape-amazon" : "/api/scrape"
      const res = await apiFetch(endpoint, {
        method: "POST",
        json: source === "amazon" ? { url, saveToDatabase: false } : { url },
      })
      const body = await res.json()
      if (!res.ok || !body?.success) {
        setError({ message: body?.error || "Could not fetch the product", hint: body?.hint })
        return
      }
      const next =
        source === "amazon" ? normaliseAmazon(body.product, url) : (body.product as ScrapedProduct)
      next.sap.sku = sku.trim()
      setProduct(next)
      setStep("review")
      toast.success(`Fetched from ${SCRAPER_LABELS[source]}`)
    } catch {
      setError({ message: "Could not reach the scraper" })
    } finally {
      setBusy(false)
    }
  }

  const setSapField = (key: keyof ScrapedProduct["sap"], value: string) => {
    setProduct((p) => (p ? { ...p, sap: { ...p.sap, [key]: value } } : p))
  }

  const handlePdf = async (file: File) => {
    if (!sku.trim()) {
      toast.error("Enter the SAP item number first")
      return
    }
    setBusy(true)
    setError(null)
    setProduct(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await apiFetch("/api/scrape/pdf", { method: "POST", body: form })
      const body = await res.json()
      if (!res.ok || !body?.success) {
        setError({ message: body?.error || "Could not read the PDF", hint: body?.hint })
        return
      }
      const next = body.product as ScrapedProduct
      next.sap.sku = sku.trim()
      setProduct(next)
      setStep("review")
      toast.success(`Imported ${Object.keys(next.technicalDetails).length} specs from the PDF`)
    } catch {
      setError({ message: "Could not upload the PDF" })
    } finally {
      setBusy(false)
    }
  }

  const handleSave = async () => {
    if (!product) return
    const { sap } = product
    if (!sap.sku.trim() || !sap.name.trim()) {
      toast.error("Item number and name are required")
      return
    }
    if (!sap.category.trim() || !sap.subCategory.trim()) {
      toast.error("Category and sub-category are required")
      return
    }

    setBusy(true)
    try {
      // 1. Create or update the product record.
      const existingRes = await apiFetch(
        `/api/products?sku=${encodeURIComponent(sap.sku)}&include_inactive=true`,
      )
      const existingBody = await existingRes.json()
      const existing = Array.isArray(existingBody)
        ? existingBody[0]
        : (existingBody?.products ?? [])[0]

      const payload = {
        sku: sap.sku,
        itemno: sap.sku,
        name: sap.name,
        brand: sap.brand,
        category: sap.category,
        subCategory: sap.subCategory,
        char_desc: sap.charDesc,
        description: product.description,
        price: sap.price ?? 0,
        mrp: product.mrp ?? sap.price ?? 0,
        image: product.images[0] ?? "",
        images: product.images.slice(0, 8),
        stock: product.inStock ? 10 : 0,
        active: false,
        source: product.source,
      }

      let productId = existing?.id
      if (existing) {
        await apiFetch(`/api/products/${existing.id}`, { method: "PATCH", json: payload })
      } else {
        const created = await apiFetch("/api/products", { method: "POST", json: payload })
        const createdBody = await created.json()
        if (!created.ok) {
          toast.error(createdBody?.error || "Could not create the product")
          return
        }
        productId = createdBody?.id ?? createdBody?.product?.id
      }

      // 2. Push enrichment into the specification record.
      const specRes = await apiFetch("/api/products/specifications/upload", {
        method: "POST",
        json: {
          specifications: [
            {
              sku: sap.sku,
              name: sap.name,
              category: sap.category,
              subCategory: sap.subCategory,
              char_desc: sap.charDesc,
              manufacturer_name: sap.brand,
              mrp: product.mrp ?? sap.price,
              overview: product.description,
              from_manufacturer: product.manufacturerInfo,
              technical_details: product.technicalDetails,
              gallery_images: product.images,
              specification_images: product.manufacturerImages,
              included_components: product.whatsIncluded,
              features: product.features,
              reviews: product.reviews,
            },
          ],
        },
      })
      const specBody = await specRes.json()
      if (specBody?.skipped > 0) {
        toast.error(specBody?.errors?.[0] || "Specification was skipped")
        return
      }

      const slugRes = await apiFetch(
        `/api/products?sku=${encodeURIComponent(sap.sku)}&include_inactive=true`,
      )
      const slugBody = await slugRes.json()
      const saved = Array.isArray(slugBody) ? slugBody[0] : (slugBody?.products ?? [])[0]
      setSavedSlug(saved?.slug ?? productId ?? null)
      setStep("done")
      toast.success("Saved to catalogue and specifications")
    } catch {
      toast.error("Could not save")
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setStep("fetch")
    setProduct(null)
    setSavedSlug(null)
    setError(null)
    setSku("")
    setUrl("")
  }

  const specCount = product ? Object.keys(product.technicalDetails).length : 0

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Download className="h-6 w-6" />
          Product scraper
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          Paste the SAP item number and a product link. The scraper fills in specifications,
          images and marketing copy, then writes both the catalogue record and its specification
          sheet in one step.
        </p>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {(
          [
            ["fetch", "1. Fetch"],
            ["review", "2. Review"],
            ["done", "3. Published"],
          ] as [Step, string][]
        ).map(([key, label], i) => (
          <li key={key} className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 font-semibold ${
                step === key
                  ? "bg-gray-900 text-white"
                  : i < ["fetch", "review", "done"].indexOf(step)
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-500"
              }`}
            >
              {label}
            </span>
            {i < 2 && <ArrowRight className="h-4 w-4 text-gray-400" />}
          </li>
        ))}
      </ol>

      {step === "fetch" && (
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block text-sm font-semibold text-gray-700">
              SAP item number *
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. REFSAM1187"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-gray-500">
                This is the join key for the whole catalogue.
              </span>
            </label>

            <label className="block text-sm font-semibold text-gray-700 md:col-span-2">
              Product link *
              <div className="relative mt-1">
                <Link2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                  placeholder="Paste an Amazon, Flipkart, Reliance, Vijay Sales, Bosch, Pai or LG link"
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm font-normal"
                />
              </div>
              <span className="mt-1 block text-xs font-normal text-gray-500">
                {source ? (
                  <span className="font-semibold text-green-700">
                    Detected: {SCRAPER_LABELS[source]}
                  </span>
                ) : url ? (
                  <span className="font-semibold text-red-600">Unrecognised link</span>
                ) : (
                  SOURCE_HINTS.map((h) => SCRAPER_LABELS[h.source]).join(" · ")
                )}
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handleFetch}
            disabled={busy || !sku.trim() || !source}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {busy ? "Fetching…" : "Fetch product data"}
          </button>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <p className="text-sm font-semibold text-gray-700">No listing anywhere?</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Upload the vendor&apos;s spec sheet and the specification table will be read straight
              out of it. Works on text PDFs; a flattened EDM flyer has no text to read.
            </p>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              <FileText className="h-4 w-4" />
              {busy ? "Reading…" : "Upload spec sheet (PDF)"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (file) handlePdf(file)
                }}
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-semibold">{error.message}</p>
              {error.hint && <p className="mt-1 text-red-700">{error.hint}</p>}
            </div>
          )}

          <div className="mt-5 rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">What each source provides</p>
            <ul className="mt-2 space-y-1">
              <li>
                <b>Amazon</b> — full specifications, A+ imagery, bullets, reviews.
              </li>
              <li>
                <b>LG India</b> — full specifications, gallery and dimension diagram, plus MRP.
                No selling price, box contents or reviews.
              </li>
              <li>
                <b>Flipkart</b> — full specification table, warranty, importer details, price,
                MRP, gallery, ratings and reviews.
              </li>
              <li>
                <b>Pai International</b> — full specifications, gallery, key features, price and
                MRP. Reviews only where the listing has them.
              </li>
              <li>
                <b>Reliance Digital</b> — full specification groups, highlights, gallery, price,
                MRP and the energy label. No reviews.
              </li>
              <li>
                <b>Vijay Sales</b> — model number, EAN, price, MRP, gallery and key features.
                They publish no specification table, so add specs from the brand listing.
              </li>
              <li>
                <b>Bosch Home</b> — full grouped specifications, gallery, highlights, price and
                MRP. Manufacturer source, so the model code is the store variant.
              </li>
            </ul>
          </div>
        </section>
      )}

      {step === "review" && product && (
        <>
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                  Basic information
                </h2>
                <p className="text-xs text-gray-500">
                  SAP will own {SAP_OWNED_FIELDS.join(", ")} once integrated.
                </p>
              </div>
              {product.source === "pdf" ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                  <FileText className="h-3 w-3" /> {product.sourceUrl}
                </span>
              ) : (
                <a
                  href={product.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
                >
                  View on {SCRAPER_LABELS[product.source]} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs font-semibold text-gray-700">
                Item number <span className="text-red-500">*</span>
                <input
                  value={product.sap.sku}
                  onChange={(e) => setSapField("sku", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal"
                />
              </label>

              <label className="block text-xs font-semibold text-gray-700 lg:col-span-3">
                Name <span className="text-red-500">*</span>
                <input
                  value={product.sap.name}
                  onChange={(e) => setSapField("name", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal"
                />
              </label>

              <SelectWithAdd
                label="Brand"
                list="brands"
                value={product.sap.brand}
                options={taxonomy.brands}
                onChange={(v) => setSapField("brand", v)}
                onAdded={loadTaxonomy}
              />
              <SelectWithAdd
                label="Category / Group name"
                list="categories"
                required
                value={product.sap.category}
                options={taxonomy.categories}
                onChange={(v) => setSapField("category", v)}
                onAdded={loadTaxonomy}
              />
              <SelectWithAdd
                label="Sub-category / PROD DESC"
                list="subCategories"
                required
                value={product.sap.subCategory}
                options={taxonomy.subCategories}
                onChange={(v) => setSapField("subCategory", v)}
                onAdded={loadTaxonomy}
              />
              <SelectWithAdd
                label="CHAR DESC"
                list="charDescs"
                value={product.sap.charDesc}
                options={taxonomy.charDescs}
                onChange={(v) => setSapField("charDesc", v)}
                onAdded={loadTaxonomy}
              />

              <label className="block text-xs font-semibold text-gray-700">
                Selling price
                <input
                  type="number"
                  value={product.sap.price ?? ""}
                  onChange={(e) =>
                    setProduct((p) =>
                      p ? { ...p, sap: { ...p.sap, price: Number(e.target.value) || null } } : p,
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal"
                />
              </label>

              <label className="block text-xs font-semibold text-gray-700">
                MRP
                <input
                  type="number"
                  value={product.mrp ?? ""}
                  onChange={(e) =>
                    setProduct((p) => (p ? { ...p, mrp: Number(e.target.value) || null } : p))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-normal"
                />
                <span className="mt-1 block text-[11px] font-normal text-gray-500">
                  {product.mrp == null
                    ? `${SCRAPER_LABELS[product.source]} does not publish MRP — enter it.`
                    : "Scraped — please confirm."}
                </span>
              </label>
            </div>
          </section>

          {product.images.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
                Images <span className="font-normal text-gray-500">({product.images.length})</span>
              </h2>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {product.images.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-lg border border-gray-200 object-contain"
                  />
                ))}
              </div>
            </section>
          )}

          <Panel title="From the manufacturer" count={product.manufacturerInfo ? 1 : 0}>
            {product.manufacturerInfo ? (
              <p className="whitespace-pre-line text-sm text-gray-700">{product.manufacturerInfo}</p>
            ) : (
              <Empty source={product.source} what="manufacturer copy" />
            )}
          </Panel>

          <Panel title="Overview" count={product.description ? 1 : 0}>
            {product.description ? (
              <p className="whitespace-pre-line text-sm text-gray-700">{product.description}</p>
            ) : (
              <Empty source={product.source} what="a description" />
            )}
          </Panel>

          <Panel title="Details & specs" count={specCount}>
            {specCount > 0 ? (
              <dl className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                {Object.entries(product.technicalDetails).map(([k, v]) => (
                  <div key={k} className="flex gap-3 border-b border-gray-100 py-1.5 text-sm">
                    <dt className="w-2/5 shrink-0 font-medium text-gray-500">{k}</dt>
                    <dd className="text-gray-900">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Empty source={product.source} what="a specification table" />
            )}
          </Panel>

          <Panel title="What's included" count={product.whatsIncluded.length}>
            {product.whatsIncluded.length > 0 ? (
              <ul className="list-inside list-disc text-sm text-gray-700">
                {product.whatsIncluded.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : (
              <Empty source={product.source} what="box contents" />
            )}
          </Panel>

          <Panel title="Key features" count={product.features.length}>
            {product.features.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-700">
                {product.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : (
              <Empty source={product.source} what="feature bullets" />
            )}
          </Panel>

          <Panel
            title="Customer reviews"
            count={product.reviews.length}
            subtitle={
              product.rating != null
                ? `${product.rating} out of 5${product.reviewCount ? ` · ${product.reviewCount} reviews` : ""}`
                : undefined
            }
          >
            {product.reviews.length > 0 ? (
              <ul className="space-y-3">
                {product.reviews.map((r, i) => (
                  <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      {r.rating != null && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-green-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {r.rating} <Star className="h-2.5 w-2.5 fill-current" />
                        </span>
                      )}
                      {r.title || "Review"}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{r.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty source={product.source} what="reviews" />
            )}
          </Panel>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              Save product and specifications
            </button>
            <button
              type="button"
              onClick={() => setStep("fetch")}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          </div>
        </>
      )}

      {step === "done" && product && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-green-900">
            <CheckCircle2 className="h-5 w-5" />
            {product.sap.sku} saved
          </h2>
          <p className="mt-1 text-sm text-green-800">
            The product was created as <b>inactive</b>. Review the specification sheet, then
            activate it on the product page when you are happy with it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/admin/product-specifications?sku=${encodeURIComponent(product.sap.sku)}`}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              <Package className="h-4 w-4" />
              Open specifications
            </Link>
            {savedSlug && (
              <a
                href={`/product/${savedSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4" />
                Preview storefront page
              </a>
            )}
            <Link
              href="/admin/products"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Product list
            </Link>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Scrape another
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
