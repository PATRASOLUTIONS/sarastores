import * as cheerio from "cheerio"
import {
  allStringsAfterKey,
  clean,
  fetchHtml,
  fetchJson,
  findLdType,
  flightPayload,
  jsonAfterKey,
  jsonArrayAfterKey,
  jsonLdNodes,
  nextData,
  toPrice,
  windowState,
} from "./http"
import { emptyProduct, ScraperError, type ScrapedProduct } from "./types"

/** Strips markup from an HTML fragment. Parsed as a fragment, because loading
 * it as a document and selecting `div` double-counts nested wrappers. */
function stripTags(fragment: string): string {
  return cheerio.load(fragment, null, false).root().text()
}

/** Pai and Flipkart both ship description and features as HTML fragments. */
function htmlToText(value: unknown): string {
  let s = String(value ?? "")
  if (!s) return ""
  s = s.replace(/<sup>\s*(?:TM|tm)\s*<\/sup>/g, "\u2122").replace(/<br\s*\/?>/gi, " ")
  // LG's FAQ copy and Pai's editor output are entity-escaped twice, so decode
  // until the text stops changing.
  for (let i = 0; i < 3 && /&[a-z#0-9]+;|<[a-z/]/i.test(s); i++) {
    const next = stripTags(s)
    if (next === s) break
    s = next
  }
  return clean(s)
}

/** `<ul><li>…</li></ul>` or `<br>`-separated marketing copy → one string per bullet. */
function htmlToList(value: unknown, limit = 20): string[] {
  let s = String(value ?? "")
  if (!s) return []
  // Vijay Sales stores this markup escaped twice over, so keep decoding until
  // the `<br>` separators are real tags.
  for (let i = 0; i < 3 && /&lt;/i.test(s); i++) {
    const next = stripTags(s)
    if (next === s) break
    s = next
  }
  const $ = cheerio.load(`<ul>${s.replace(/<br\s*\/?>/gi, "</li><li>")}</ul>`, null, false)
  const items = $("li")
    .map((_, el) => htmlToText($(el).html() ?? $(el).text()))
    .get()
    .filter(Boolean)
  if (items.length) return [...new Set(items)].slice(0, limit)
  const text = htmlToText(s)
  return text ? [text] : []
}

/** Breadcrumb → the two most specific levels that are real taxonomy. */
function crumbsToTaxonomy(crumbs: string[], brand: string): { category: string; subCategory: string } {
  const brandLower = brand.toLowerCase()
  const meaningful = crumbs
    .map(clean)
    .filter(Boolean)
    .filter((c) => !/^home$/i.test(c))
    // Flipkart appends a brand-scoped leaf ("Samsung Refrigerators") that is not
    // a real taxonomy level.
    .filter((c) => !brandLower || !c.toLowerCase().startsWith(`${brandLower} `))
  if (meaningful.length === 0) return { category: "", subCategory: "" }
  if (meaningful.length === 1) return { category: meaningful[0], subCategory: "" }
  return { category: meaningful[meaningful.length - 2], subCategory: meaningful[meaningful.length - 1] }
}

function ldBreadcrumbs(html: string): string[] {
  return (findLdType(html, "BreadcrumbList")?.itemListElement ?? [])
    .map((i: any) => clean(i?.name ?? i?.item?.name))
    .filter(Boolean)
}

const absolute = (base: string, src: string) => {
  const s = clean(src)
  if (!s) return ""
  if (/^https?:\/\//i.test(s)) return s
  if (s.startsWith("//")) return `https:${s}`
  return s.startsWith("/") ? `${base}${s}` : ""
}

/* ------------------------------------------------------------------ *
 * Pai International
 * ------------------------------------------------------------------ */

/**
 * Pai runs a Next.js pages-router storefront. The served HTML carries only a
 * summary (`__NEXT_DATA__` plus a `Product` JSON-LD block); the MRP, image
 * gallery, spec groups and key features come from the same JSON endpoint the
 * page itself calls on mount.
 */
export async function scrapePai(url: string): Promise<ScrapedProduct> {
  const { html, finalUrl } = await fetchHtml(url)
  const product = emptyProduct("pai", finalUrl)

  const slug = new URL(finalUrl).pathname.split("/").filter(Boolean).pop() ?? ""
  const api = slug
    ? ((await fetchJson<any>(`https://www.paiinternational.in/api/product-detail/${slug}/`))?.data ?? null)
    : null

  const ld = findLdType(html, "Product")
  const summary = nextData(html)?.props?.pageProps?.productdetails ?? null

  if (!api && !ld && !summary) {
    throw new ScraperError("No product data found on the page", 422, "Check the URL points at a product-details page.")
  }

  product.sap.name = clean(api?.title ?? summary?.name ?? ld?.name)
  product.sap.brand = clean(api?.brand?.name ?? summary?.brand ?? ld?.brand?.name)
  product.sap.sku = clean(api?.upc ?? summary?.sku ?? ld?.sku)
  product.sap.price = toPrice(api?.current_price ?? summary?.price ?? ld?.offers?.price)
  product.externalId = product.sap.sku || null
  product.mrp = toPrice(api?.mrp)

  // The API's own two-level taxonomy beats the breadcrumb, whose last crumb is
  // the full product title rather than a category.
  const apiCategory = clean(api?.parent_category?.name)
  const apiSubCategory = clean(api?.category?.name ?? summary?.category)
  if (apiCategory || apiSubCategory) {
    product.sap.category = apiCategory || apiSubCategory
    product.sap.subCategory = apiCategory ? apiSubCategory : ""
  } else {
    const taxonomy = crumbsToTaxonomy(ldBreadcrumbs(html).slice(0, -1), product.sap.brand)
    product.sap.category = taxonomy.category
    product.sap.subCategory = taxonomy.subCategory
  }

  const images = new Set<string>()
  for (const img of api?.images ?? []) {
    const src = clean(img?.image ?? img?.thumbnail_large ?? img)
    if (/^https?:\/\//i.test(src)) images.add(src)
  }
  for (const src of [ld?.image, summary?.image].flat()) {
    const s = clean(src)
    if (/^https?:\/\//i.test(s)) images.add(s)
  }
  product.images = [...images]

  product.description = htmlToText(api?.description ?? summary?.description ?? ld?.description)
  product.features = htmlToList(api?.key_features)
  product.rating = toPrice(api?.average_rating ?? ld?.aggregateRating?.ratingValue)
  product.reviewCount = Number(api?.total_reviews ?? ld?.aggregateRating?.reviewCount) || null
  product.inStock = !/OutOfStock/i.test(String(ld?.offers?.availability ?? ""))

  // Spec groups arrive as [{ title, attribute_list: [{ key, value }] }].
  const specs: Record<string, string> = {}
  const manufacturer: string[] = []
  for (const group of api?.get_attributes_list ?? []) {
    const groupTitle = clean(group?.title)
    for (const row of group?.attribute_list ?? []) {
      const k = clean(row?.key)
      const v = clean(row?.value)
      if (!k || !v) continue
      specs[k] = v
      if (/manufacturer|importer|packer/i.test(groupTitle)) manufacturer.push(`${k}: ${v}`)
      if (/^in the box$/i.test(k)) {
        product.whatsIncluded = v.split(/,|\r?\n/).map(clean).filter(Boolean)
      }
      if (/warranty/i.test(k) && !product.warranty) product.warranty = v
    }
  }
  product.technicalDetails = specs
  product.manufacturerInfo = manufacturer.join("\n")
  product.sap.charDesc = specs["Model Name"] ?? specs["Model Number"] ?? ""

  product.reviews = (api?.reviews ?? [])
    .map((r: any) => ({
      rating: toPrice(r?.rating),
      title: clean(r?.title ?? r?.heading),
      text: htmlToText(r?.review ?? r?.comment ?? r?.description),
    }))
    .filter((r: { title: string; text: string }) => r.text || r.title)
    .slice(0, 8)

  if (!product.sap.name) throw new ScraperError("Product name not found", 422)
  return product
}

/* ------------------------------------------------------------------ *
 * LG India
 * ------------------------------------------------------------------ */

interface LgSpecGroup {
  title?: string
  spec?: { name?: string; value?: string }[]
}

/**
 * LG India is an App Router site that renders the whole PDP from a streamed
 * React server-component payload — the served DOM has no price, no model code
 * and no spec table. Everything below is read out of that payload instead.
 */
export async function scrapeLg(url: string): Promise<ScrapedProduct> {
  const { html, finalUrl } = await fetchHtml(url, 45000)
  const $ = cheerio.load(html)
  const product = emptyProduct("lg", finalUrl)
  const flight = flightPayload(html)

  const info: any = jsonAfterKey(flight, "productInfo")
  const ogTitle = clean($('meta[property="og:title"]').attr("content"))

  product.sap.brand = "LG"
  product.sap.name = clean(info?.userFriendlyName) || clean($("h1").first().text()) || ogTitle
  product.description = clean($('meta[property="og:description"]').attr("content"))

  // The model code identifies the product upstream and is what SAP carries as
  // the characteristic description.
  const segments = new URL(finalUrl).pathname.split("/").filter(Boolean)
  const modelCode =
    clean(info?.salesModelCode ?? info?.modelName) || (segments[segments.length - 1] ?? "").toUpperCase()
  product.externalId = modelCode || null
  product.sap.charDesc = modelCode
  product.sap.sku = clean(info?.sku)
  product.mrp = toPrice(info?.msrp)

  product.sap.category = clean(info?.categoryName)
  product.sap.subCategory = clean(info?.subCategoryName)
  if (!product.sap.category) {
    const taxonomy = crumbsToTaxonomy(
      ldBreadcrumbs(html).filter((c) => c.toUpperCase() !== modelCode.toUpperCase()),
      "LG",
    )
    product.sap.category = taxonomy.category
    product.sap.subCategory = taxonomy.subCategory
  }

  const specs: Record<string, string> = {}
  for (const key of ["productSpecTechSpecList", "productSpecKeySpecList"]) {
    const groups: LgSpecGroup[] = jsonAfterKey(flight, key) ?? []
    if (!Array.isArray(groups)) continue
    for (const group of groups) {
      for (const row of group?.spec ?? []) {
        const k = clean(row?.name)
        const v = clean(row?.value)
        if (!k || !v || k === v) continue
        specs[k] = v
        if (/warranty/i.test(k) && !product.warranty) product.warranty = v
      }
    }
  }
  product.technicalDetails = specs

  const bullets: any[] = jsonAfterKey(flight, "bulletFeaturesList") ?? info?.bulletFeatures ?? []
  const features = (Array.isArray(bullets) ? bullets : []).map((f: any) => htmlToText(f?.bulletFeatureDesc)).filter(Boolean)
  product.features = [...new Set(features)].slice(0, 12)

  const images = new Set<string>()
  const push = (src: unknown) => {
    const s = absolute("https://www.lg.com", String(src ?? ""))
    if (s && !/icon|logo|sprite|\.svg($|\?)/i.test(s)) images.add(s.split("?")[0])
  }
  push(info?.largeImageAddr)
  allStringsAfterKey(flight, "galleryImageRef").forEach(push)
  push($('meta[property="og:image"]').attr("content"))
  product.images = [...images].slice(0, 12)

  // The dimension diagram is a spec sheet asset, not a gallery shot.
  const dimension: any = jsonAfterKey(flight, "productSpecDimensionList")
  const dimensionImage = absolute("https://www.lg.com", String(dimension?.imagePathName ?? ""))
  if (dimensionImage) product.manufacturerImages = [dimensionImage]

  // LG publishes a per-model FAQ block; it is the only long-form copy on the
  // page and reads well as spec-sheet context.
  const faq = jsonLdNodes(html).find((n) => String(n?.["@type"] ?? "").toLowerCase() === "faqpage")
  const faqLines = (faq?.mainEntity ?? [])
    .map((q: any) => `${htmlToText(q?.name)} ${htmlToText(q?.acceptedAnswer?.text)}`.trim())
    .filter(Boolean)
  if (faqLines.length) product.manufacturerInfo = faqLines.slice(0, 8).join("\n\n")

  if (!product.sap.name) throw new ScraperError("Product name not found", 422)
  if (Object.keys(product.technicalDetails).length === 0 && product.images.length === 0) {
    throw new ScraperError(
      "Page loaded but contained no product details",
      422,
      "LG serves regional redirects — make sure the link starts with lg.com/in/.",
    )
  }
  return product
}

/* ------------------------------------------------------------------ *
 * Flipkart
 * ------------------------------------------------------------------ */

type LabelRow = Record<string, string>

/** Flipkart's design-system rows put the key in `label_0` and the value in a later `label_N`. */
function dlsText(node: any): string {
  const t = node?.value?.text
  if (Array.isArray(t)) return clean(t.filter((x: unknown) => typeof x === "string").join(", "))
  if (typeof t === "string") return clean(t)
  // Pricing labels are gated behind a client state rule for logged-in offers.
  const gated = node?.value?.UNLOCKED?.value?.text ?? node?.value?.LOCKED?.value?.text
  return typeof gated === "string" ? clean(gated) : ""
}

/**
 * Walks a widget payload and yields every `label_*` cluster it contains. The
 * class names in Flipkart's DOM are obfuscated and rotate, but these data keys
 * are part of their rendering contract and stay put.
 */
function collectLabelRows(node: any, out: LabelRow[] = []): LabelRow[] {
  if (!node || typeof node !== "object") return out
  if (Array.isArray(node)) {
    node.forEach((v) => collectLabelRows(v, out))
    return out
  }
  const labelKeys = Object.keys(node).filter((k) => /^label_\d+$/.test(k))
  if (labelKeys.length >= 2) {
    const row: LabelRow = {}
    for (const k of labelKeys) row[k] = dlsText(node[k])
    out.push(row)
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "action" || k === "tracking" || k === "trackerData_0") continue
    collectLabelRows(v, out)
  }
  return out
}

const labelOrder = (row: LabelRow) => Object.keys(row).sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)))

/**
 * Finds a node by the stable part of its data key. Flipkart numbers these keys
 * per layout (`rpd_warranty_item_0` on the vertical PDP, `_5` on the horizontal
 * one), so only the prefix can be relied on.
 */
function findByKeyPrefix(node: any, prefix: RegExp): any {
  if (!node || typeof node !== "object") return null
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findByKeyPrefix(v, prefix)
      if (hit) return hit
    }
    return null
  }
  for (const [k, v] of Object.entries(node)) {
    if (prefix.test(k)) return v
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "action" || k === "tracking" || k === "trackerData_0") continue
    const hit = findByKeyPrefix(v, prefix)
    if (hit) return hit
  }
  return null
}

/** Reads `window.__INITIAL_STATE__` out of the served HTML. */
function flipkartWidgets(state: any): { viewType: string; data: any }[] {
  return (state?.multiWidgetState?.widgetsData?.slots ?? [])
    .map((slot: any) => slot?.slotData?.widget)
    .filter(Boolean)
    .map((w: any) => ({ viewType: String(w?.viewType ?? ""), data: w?.data }))
}

/**
 * Flipkart server-renders a `Product` JSON-LD block (name, brand, price,
 * gallery, rating, reviews) but keeps the spec table, the MRP and the
 * breadcrumb inside its Redux store. Both are read here.
 */
export async function scrapeFlipkart(url: string): Promise<ScrapedProduct> {
  const { html, finalUrl } = await fetchHtml(url)
  const product = emptyProduct("flipkart", finalUrl)

  if (/enter the characters|retry_captcha|are you a human/i.test(html.slice(0, 8000))) {
    throw new ScraperError(
      "Flipkart served its bot check instead of the product page",
      429,
      "Wait a minute and retry, or use the Amazon/Pai listing for the same model.",
    )
  }

  const $ = cheerio.load(html)
  const ld = findLdType(html, "Product")
  const widgets = flipkartWidgets(windowState(html))
  const widget = (match: RegExp) => widgets.find((w) => match.test(w.viewType))?.data

  product.sap.name = clean(ld?.name) || clean($("h1").first().text())
  product.sap.brand = clean(ld?.brand?.name ?? ld?.brand)
  product.sap.sku = clean(ld?.sku)
  product.sap.price = toPrice(ld?.offers?.price ?? ld?.offers?.lowPrice)
  product.externalId = product.sap.sku || null
  product.rating = toPrice(ld?.aggregateRating?.ratingValue)
  product.reviewCount = Number(ld?.aggregateRating?.reviewCount ?? ld?.aggregateRating?.ratingCount) || null
  product.inStock = !/OutOfStock/i.test(String(ld?.offers?.availability ?? ""))
  product.description = htmlToText(ld?.description)

  // Flipkart serves the same asset from several CDN hosts at several sizes, so
  // dedupe on the filename and always ask for the largest rendition.
  const images = new Map<string, string>()
  const pushImage = (v: unknown) => {
    const s = clean(v)
    // `/image/<w>/<h>/` is a product shot; `fk-p-flap` and friends are banners.
    if (!/^https?:\/\/[^/]*flixcart\.com\/image\/\d+\/\d+\//i.test(s)) return
    const url = s.replace(/\/image\/\d+\/\d+\//, "/image/1500/1500/").split("?")[0]
    const key = url.split("/").pop() ?? url
    if (!images.has(key)) images.set(key, url)
  }
  if (Array.isArray(ld?.image)) ld.image.forEach(pushImage)
  else pushImage(ld?.image)
  $("img[src*='rukmini']").each((_, el) => pushImage($(el).attr("src")))
  product.images = [...images.values()].slice(0, 12)

  // Breadcrumb widget: one entry per level, each rendered as its own label row.
  const crumbs = (widget(/breadcrumb/i)?.dlsData?.horizontalListData_0?.value ?? [])
    .map((c: any) => dlsText(c?.value?.label_0))
    .filter(Boolean)
  const taxonomy = crumbsToTaxonomy(crumbs, product.sap.brand)
  product.sap.category = taxonomy.category || clean(ld?.category).replace(/_/g, " ")
  product.sap.subCategory = taxonomy.subCategory

  // Pricing widget carries selling price, MRP and discount as sibling labels;
  // the MRP is the cheapest figure still above the selling price.
  const priceFigures = collectLabelRows(widget(/pricing|price_summary/i))
    .flatMap((row) => Object.values(row))
    .filter((t) => /^₹?\s?[\d,]+(\.\d+)?$/.test(t))
    .map((t) => toPrice(t))
    .filter((n): n is number => typeof n === "number")
  const price = product.sap.price
  product.mrp = price ? (priceFigures.filter((n) => n > price).sort((a, b) => a - b)[0] ?? null) : null

  const details = widget(/rpd_all_details|rich_product_details/i)
  const specs: Record<string, string> = {}
  if (details) {
    const specGrid = findByKeyPrefix(details, /^rpd_specifications_grid_layout_/) ?? details
    for (const row of collectLabelRows(specGrid)) {
      const key = row.label_0
      if (!key || key.length > 90) continue
      const value = labelOrder(row)
        .slice(1)
        .map((k) => row[k])
        .find((v) => v && v !== key)
      if (!value || value.length > 1200) continue
      specs[key] = value
    }

    // The warranty block alternates label_0..label_n as key, value, key, value.
    const warrantyRow = collectLabelRows(findByKeyPrefix(details, /^rpd_warranty_item_/))[0]
    if (warrantyRow) {
      const ordered = labelOrder(warrantyRow).map((k) => warrantyRow[k])
      for (let i = 0; i + 1 < ordered.length; i += 2) {
        if (ordered[i] && ordered[i + 1]) specs[ordered[i]] = ordered[i + 1]
      }
      product.warranty = ordered[1] ?? ""
    }

    const longDescription = dlsText(findByKeyPrefix(details, /^rpd_description_item_/)?.value?.label_0)
    if (longDescription.length > product.description.length) product.description = longDescription

    product.manufacturerInfo = collectLabelRows(findByKeyPrefix(details, /^rpd_manufacture_layout_/))
      .filter((row) => row.label_0 && row.label_1)
      .map((row) => `${row.label_0}: ${row.label_1}`)
      .join("\n")
  }
  if (clean(ld?.color) && !specs.Color) specs.Color = clean(ld.color)
  product.technicalDetails = specs

  const salesPackage = specs["Sales Package"] ?? specs["In The Box"] ?? specs["In the Box"]
  if (salesPackage) product.whatsIncluded = salesPackage.split(/,|\r?\n/).map(clean).filter(Boolean)
  product.sap.charDesc = specs["Model Name"] ?? specs["Model Number"] ?? specs["Model ID"] ?? ""

  product.features = Object.entries(specs)
    .map(([k, v]) => (/^(yes|no)$/i.test(v) ? k : `${k}: ${v}`))
    .filter((f) => f.length > 5 && f.length < 160)
    .slice(0, 12)

  if (Array.isArray(ld?.review)) {
    product.reviews = ld.review
      .map((r: any) => ({
        rating: toPrice(r?.reviewRating?.ratingValue),
        title: clean(r?.name),
        text: htmlToText(r?.reviewBody ?? r?.description),
      }))
      .filter((r: { title: string; text: string }) => r.text || r.title)
      .slice(0, 8)
  }

  if (!product.sap.name) {
    throw new ScraperError("Product name not found", 422, "Flipkart may have served a bot check — retry in a minute.")
  }
  return product
}

/* ------------------------------------------------------------------ *
 * Reliance Digital
 * ------------------------------------------------------------------ */

/**
 * Reliance Digital runs on Jio's commerce platform and hydrates the whole PDP
 * from `window.__INITIAL_STATE__`. Its JSON-LD carries only name, brand and the
 * selling price, so everything else — MRP, spec groups, highlights, gallery —
 * comes out of that store.
 */
export async function scrapeReliance(url: string): Promise<ScrapedProduct> {
  const { html, finalUrl } = await fetchHtml(url)
  const product = emptyProduct("reliance", finalUrl)

  const page = windowState(html)?.productDetailsPage
  const item = page?.product
  const meta = page?.product_meta
  const ld = findLdType(html, "Product")

  if (!item?.name && !ld?.name) {
    throw new ScraperError("No product data found on the page", 422, "Check the URL points at a /product/ page.")
  }

  product.sap.name = clean(item?.name ?? ld?.name)
  product.sap.brand = clean(item?.brand?.name ?? ld?.brand)
  product.sap.sku = clean(item?.item_code ?? ld?.productID)
  product.externalId = product.sap.sku || null
  product.sap.price = toPrice(meta?.price?.effective?.min ?? ld?.offers?.price)
  product.mrp = toPrice(meta?.price?.marked?.min)
  product.inStock = meta?.sellable !== false && !/OutOfStock/i.test(String(ld?.offers?.availability ?? ""))
  product.rating = toPrice(ld?.aggregateRating?.ratingValue)
  product.reviewCount = Number(ld?.aggregateRating?.ratingCount) || null

  // category_map.l1 is the storefront itself ("Reliance Digital"), so the two
  // usable taxonomy levels are l2 and l3.
  const map = item?.category_map ?? {}
  product.sap.category = clean(map.l2?.name)
  product.sap.subCategory = clean(map.l3?.name ?? item?.categories?.[0]?.name)
  if (!product.sap.category) {
    const taxonomy = crumbsToTaxonomy([clean(map.l3?.name), clean(item?.categories?.[0]?.name)], product.sap.brand)
    product.sap.category = taxonomy.category
    product.sap.subCategory = taxonomy.subCategory
  }

  product.description = htmlToText(item?.description ?? item?.short_description ?? ld?.description)
  product.features = (item?.highlights ?? []).map((h: unknown) => htmlToText(h)).filter(Boolean).slice(0, 12)

  // grouped_attributes: [{ title, details: [{ key, value }] }].
  const specs: Record<string, string> = {}
  const manufacturer: string[] = []
  for (const group of item?.grouped_attributes ?? []) {
    const groupTitle = clean(group?.title)
    for (const row of group?.details ?? []) {
      const k = clean(row?.key)
      const v = clean(row?.value)
      if (!k || !v || k === v) continue
      specs[k] = v
      if (/manufactur|packing|importer|marketed/i.test(groupTitle)) manufacturer.push(`${k}: ${v}`)
      if (/warranty/i.test(k) && !product.warranty) product.warranty = v
      if (/^(in the box|box contents|sales package)$/i.test(k)) {
        product.whatsIncluded = v.split(/,|\r?\n/).map(clean).filter(Boolean)
      }
    }
  }
  if (clean(item?.country_of_origin)) specs["Country of Origin"] ||= clean(item.country_of_origin)
  product.technicalDetails = specs
  product.manufacturerInfo = manufacturer.join("\n")
  product.sap.charDesc = specs.Model ?? specs["Model Name"] ?? specs["Model Number"] ?? ""

  // Energy-label shots are filed with the gallery but belong on the spec sheet.
  const gallery: string[] = []
  const labels: string[] = []
  for (const media of item?.medias ?? []) {
    if (media?.type !== "image") continue
    const src = clean(media?.url)
    if (!/^https?:\/\//i.test(src)) continue
    ;(/[_-]BEE[-_]|energy-label/i.test(src) ? labels : gallery).push(src)
  }
  const primary = clean(ld?.image)
  if (/^https?:\/\//i.test(primary) && !gallery.includes(primary)) gallery.unshift(primary)
  product.images = [...new Set(gallery)].slice(0, 12)
  product.manufacturerImages = [...new Set(labels)]

  if (!product.sap.name) throw new ScraperError("Product name not found", 422)
  return product
}

/* ------------------------------------------------------------------ *
 * Vijay Sales
 * ------------------------------------------------------------------ */

/**
 * Vijay Sales is an AEM storefront over Magento. Identity, price and the
 * gallery are server-rendered; the long description comes from the Magento
 * GraphQL endpoint the page itself queries.
 *
 * They publish no specification table anywhere — the on-page accordion is
 * empty for every product and the rich content is a third-party Flixmedia
 * iframe — so `technicalDetails` is built from what they do expose.
 */
export async function scrapeVijaySales(url: string): Promise<ScrapedProduct> {
  const { html, finalUrl } = await fetchHtml(url)
  const $ = cheerio.load(html)
  const product = emptyProduct("vijaysales", finalUrl)

  const ld = findLdType(html, "Product")
  if (!ld?.name) {
    throw new ScraperError("No product data found on the page", 422, "Check the URL looks like /p/<id>/<slug>.")
  }

  product.sap.name = clean(ld.name)
  product.sap.brand = clean(ld?.brand?.name ?? ld?.brand)
  product.sap.sku = clean(ld?.sku)
  product.externalId = product.sap.sku || null
  product.sap.price = toPrice(ld?.offers?.price ?? ld?.offers?.lowPrice)
  product.inStock = !/OutOfStock/i.test(String(ld?.offers?.availability ?? ""))

  const taxonomy = crumbsToTaxonomy(ldBreadcrumbs(html).slice(0, -1), product.sap.brand)
  product.sap.category = taxonomy.category || clean(ld?.category)
  product.sap.subCategory = taxonomy.subCategory

  // MRP is only ever rendered as a data attribute on the price block.
  product.mrp = toPrice($("[data-mrp]").first().attr("data-mrp"))

  // The Flixmedia hook is where the manufacturer part number and EAN surface.
  const mpn = clean($("[data-flix-mpn]").first().attr("data-flix-mpn") ?? ld?.mpn)
  const ean = clean($("[data-flix-ean]").first().attr("data-flix-ean") ?? ld?.gtin)
  product.sap.charDesc = mpn

  // The gallery ships as an HTML-escaped JSON array on the slider element.
  const images = new Set<string>()
  try {
    for (const entry of JSON.parse($("[data-gallery-items]").first().attr("data-gallery-items") || "[]")) {
      const src = clean(entry?.url ?? entry?.path)
      // Their CDN takes the box size from the query string; ask for a large one.
      if (/^https?:\/\//i.test(src)) images.add(src.replace(/([?&](height|width))=\d*/g, "$1=1000"))
    }
  } catch {
    /* fall back to the JSON-LD image list below */
  }
  for (const src of [ld?.image].flat()) {
    const s = clean(src)
    if (/^https?:\/\//i.test(s)) images.add(s)
  }
  product.images = [...images].slice(0, 12)

  // Magento carries the long copy; the storefront never renders it server-side.
  const gql = await fetchJson<any>(
    "https://vsprod.vijaysales.com/graphql?query=" +
      encodeURIComponent(
        `{products(search:"",filter:{sku:{in:["${product.sap.sku}"]}}){items{description{html} short_description{html} stock_status}}}`,
      ),
  )
  const magento = gql?.data?.products?.items?.[0]
  product.description = htmlToText(magento?.description?.html)
  if (magento?.stock_status) product.inStock = magento.stock_status === "IN_STOCK"

  // Key features are the same <br>-separated bullets, sometimes rendered into
  // the page and sometimes only present in Magento. The on-page list is often
  // present but blank, so test its text rather than the markup.
  const onPage = $("ul.product__keyfeatures--list").first().html() ?? ""
  const featureSource = clean(stripTags(onPage)) ? onPage : magento?.description?.html
  product.features = htmlToList(featureSource, 12).filter((f) => f.length > 8 && f.length < 300)
  if (!product.description) product.description = product.features.join(" ")

  const specs: Record<string, string> = {}
  if (mpn) specs["Model Number"] = mpn
  if (ean) specs["EAN"] = ean
  if (product.sap.brand) specs.Brand = product.sap.brand
  // short_description is a <br>-separated highlight list, the closest thing to
  // a spec sheet Vijay Sales publishes.
  for (const line of htmlToList(magento?.short_description?.html)) {
    const [, key, value] = line.match(/^(.{2,40}?)\s*[:\u2013-]\s*(.+)$/) ?? []
    if (key && value) specs[clean(key)] = clean(value)
    else if (/^([\d.]+\s*\w+)\s+(.+)$/.test(line)) {
      const [, amount, label] = line.match(/^([\d.]+\s*\w+)\s+(.+)$/)!
      specs[clean(label)] = clean(amount)
    }
    if (/warranty/i.test(line) && !product.warranty) product.warranty = line
  }
  product.technicalDetails = specs

  return product
}

/* ------------------------------------------------------------------ *
 * Bosch Home
 * ------------------------------------------------------------------ */

interface BoschSpecRow {
  name?: { text?: string }
  value?: { text?: string }
  unit?: string | null
  requiresValueTranslation?: boolean
}

/**
 * Bosch runs the BSH App Router storefront. Identity, gallery and price are in
 * a `Product` JSON-LD block; the grouped specification table, MRP and feature
 * highlights only exist in the streamed server-component payload.
 */
export async function scrapeBosch(url: string): Promise<ScrapedProduct> {
  const { html, finalUrl } = await fetchHtml(url, 45000)
  const $ = cheerio.load(html)
  const product = emptyProduct("bosch", finalUrl)
  const flight = flightPayload(html)

  const ld = findLdType(html, "Product")
  if (!ld?.name && !ld?.mpn) {
    throw new ScraperError("No product data found on the page", 422, "Check the URL looks like /en/product/…/<MODEL>.")
  }

  const model = clean(ld?.mpn)
  product.sap.name = clean(ld?.name)
  product.sap.brand = "Bosch"
  product.sap.sku = model
  product.sap.charDesc = model
  product.externalId = model || null
  product.sap.price = toPrice(ld?.offers?.price)
  product.description = clean(ld?.description)
  product.inStock = !/OutOfStock|Discontinued/i.test(String(ld?.offers?.availability ?? ""))
  product.rating = toPrice(ld?.aggregateRating?.ratingValue)
  product.reviewCount = Number(ld?.aggregateRating?.reviewCount) || null
  product.images = [ld?.image].flat().map(clean).filter((s) => /^https?:\/\//i.test(s)).slice(0, 12)

  // The i18n bundle also has a `recommendedRetailPrice` key, so match the shape
  // that actually carries a number.
  const rrp = flight.match(/"recommendedRetailPrice":\{"amount":\s*(\d+(?:\.\d+)?)/)
  product.mrp = toPrice(rrp?.[1])

  // /en/product/<group>/<family>/<category>/<model>
  const segments = new URL(finalUrl).pathname.split("/").filter(Boolean)
  const afterProduct = segments.slice(segments.indexOf("product") + 1, -1)
  const humanise = (s: string) => clean(s.replace(/-/g, " ")).replace(/\b\w/g, (c) => c.toUpperCase())
  product.sap.category = afterProduct[0] ? humanise(afterProduct[0]) : ""
  const crumb = ldBreadcrumbs(html).find((c) => !/^(root|shop)$/i.test(c) && c.toUpperCase() !== model.toUpperCase())
  product.sap.subCategory = crumb || (afterProduct[afterProduct.length - 1] ? humanise(afterProduct[afterProduct.length - 1]) : "")

  const specs: Record<string, string> = {}
  const addRow = (row: BoschSpecRow) => {
    const k = clean(row?.name?.text)
    let v = clean(row?.value?.text)
    if (!k || !v) return
    // Booleans arrive as an untranslated i18n key.
    if (row?.requiresValueTranslation) v = /\.no$/i.test(v) ? "No" : /\.yes$/i.test(v) ? "Yes" : (v.split(".").pop() ?? v)
    if (row?.unit) v = `${v} ${clean(row.unit)}`
    specs[k] = v
  }
  for (const group of jsonArrayAfterKey<any>(flight, "specifications")) {
    for (const row of group?.specifications ?? []) addRow(row)
  }
  const overview = jsonArrayAfterKey<BoschSpecRow>(flight, "overviewSpecifications")
  overview.forEach(addRow)
  if (clean(ld?.gtin)) specs.EAN = clean(ld.gtin)
  product.technicalDetails = specs

  product.features = jsonArrayAfterKey<any>(flight, "highlights")
    .map((h: any) => htmlToText(h?.headline?.text ?? h?.text?.text))
    .filter(Boolean)
    .slice(0, 12)
  // Not every model has highlight tiles; the key-spec strip is the next best thing.
  if (product.features.length === 0) {
    product.features = overview
      .map((row) => {
        const k = clean(row?.name?.text)
        const v = clean(specs[k])
        return k && v ? `${k}: ${v}` : ""
      })
      .filter(Boolean)
      .slice(0, 12)
  }

  if (!product.sap.name) throw new ScraperError("Product name not found", 422)
  return product
}

/** Re-exported so the API route can enumerate what a source produced. */
export const ADAPTERS = {
  pai: scrapePai,
  lg: scrapeLg,
  flipkart: scrapeFlipkart,
  reliance: scrapeReliance,
  vijaysales: scrapeVijaySales,
  bosch: scrapeBosch,
}

export { jsonLdNodes }
