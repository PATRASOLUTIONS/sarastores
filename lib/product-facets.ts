/**
 * Spec-driven facets for category and listing pages
 * ("CATEGORY PAGE — REBUILD COMPLETELY" in the BRD).
 *
 * Product specs in this catalogue are heterogeneous: `technical_details` is a
 * free-form `Record<string, unknown>` whose keys differ per import, and a lot of
 * the useful detail only exists inside the product name ("Samsung 55 inch 4K
 * Smart TV"). Rather than block facets behind a data migration, values are
 * normalised at read time from the name, char_desc and any spec keys that
 * fuzzy-match — the same approach `lib/search-query.ts` takes for queries.
 *
 * Facets are only offered when the current result set actually contains more
 * than one value, so a category never shows a filter that cannot narrow it.
 */

export interface FacetValue {
  value: string
  count: number
}

export interface Facet {
  key: string
  label: string
  values: FacetValue[]
}

export type FacetSelection = Record<string, string[]>

export interface FacetProduct {
  name?: unknown
  char_desc?: unknown
  charDesc?: unknown
  type?: unknown
  subCategory?: unknown
  technical_details?: Record<string, unknown> | null
  /** Flipkart-style spec sheet stored on the product. Mobile filters read this. */
  specifications?: Record<string, unknown> | null
  features?: readonly unknown[] | null
}

interface FacetDefinition {
  key: string
  label: string
  /** Keys in `technical_details` that may hold this attribute, lower-cased. */
  specKeys: string[]
  /** Extract normalised values from a blob of product text. */
  extract: (text: string) => string[]
  /** Sort order for the rendered values; defaults to alphabetical. */
  sort?: (a: string, b: string) => number
}

const numericSort = (a: string, b: string) => parseFloat(a) - parseFloat(b)

/** Match a set of keyword → label pairs anywhere in the text. */
function keywordExtractor(map: [RegExp, string][]) {
  return (text: string): string[] => {
    const found = new Set<string>()
    for (const [pattern, label] of map) {
      if (pattern.test(text)) found.add(label)
    }
    return Array.from(found)
  }
}

const FACET_DEFINITIONS: FacetDefinition[] = [
  {
    key: "screenSize",
    label: "Screen Size",
    specKeys: ["screen size", "display size", "screen_size", "size"],
    sort: numericSort,
    extract: (text) => {
      // 24–120" covers everything from monitors to the largest panels; anything
      // outside that range is almost always a different measurement.
      const match = text.match(/\b(\d{2,3})\s*(?:-\s*)?(?:inch(?:es)?|"|''|\bin\b)/i)
      if (!match) return []
      const inches = Number(match[1])
      return inches >= 10 && inches <= 120 ? [`${inches}"`] : []
    },
  },
  {
    key: "capacityLitres",
    label: "Capacity (Litres)",
    specKeys: ["capacity", "gross volume", "total capacity"],
    sort: numericSort,
    extract: (text) => {
      const match = text.match(/\b(\d{2,4})\s*(?:l\b|ltr|litre?s?|liters?)/i)
      if (!match) return []
      const litres = Number(match[1])
      if (litres < 30 || litres > 900) return []
      if (litres < 200) return ["Under 200 L"]
      if (litres < 300) return ["200–300 L"]
      if (litres < 400) return ["300–400 L"]
      if (litres < 550) return ["400–550 L"]
      return ["550 L & above"]
    },
  },
  {
    key: "capacityKg",
    label: "Capacity (Kg)",
    specKeys: ["capacity", "washing capacity", "load capacity"],
    sort: numericSort,
    extract: (text) => {
      const match = text.match(/\b(\d{1,2}(?:\.\d)?)\s*kg\b/i)
      if (!match) return []
      const kg = Number(match[1])
      return kg >= 5 && kg <= 15 ? [`${kg} kg`] : []
    },
  },
  {
    key: "capacityTon",
    label: "Capacity (Ton)",
    specKeys: ["capacity", "cooling capacity"],
    sort: numericSort,
    extract: (text) => {
      const match = text.match(/\b(\d(?:\.\d)?)\s*(?:ton|tr)\b/i)
      if (!match) return []
      const ton = Number(match[1])
      return ton >= 0.5 && ton <= 5 ? [`${ton} Ton`] : []
    },
  },
  {
    key: "energyRating",
    label: "Energy Rating",
    specKeys: ["energy rating", "star rating", "bee rating"],
    sort: numericSort,
    extract: (text) => {
      const match = text.match(/\b([1-5])\s*(?:-\s*)?star\b/i)
      return match ? [`${match[1]} Star`] : []
    },
  },
  {
    key: "displayTech",
    label: "Display Technology",
    specKeys: ["display technology", "panel type", "display type"],
    extract: keywordExtractor([
      [/\bmini\s*-?\s*led\b/i, "Mini LED"],
      [/\bqned\b/i, "QNED"],
      [/\bqled\b/i, "QLED"],
      [/\boled\b/i, "OLED"],
      [/\bneo\s*qled\b/i, "Neo QLED"],
      [/\bamoled\b/i, "AMOLED"],
      [/\bl\.?e\.?d\b/i, "LED"],
    ]),
  },
  {
    key: "resolution",
    label: "Resolution",
    specKeys: ["resolution", "display resolution", "screen resolution"],
    extract: keywordExtractor([
      [/\b8k\b/i, "8K"],
      [/\b4k\b|\bultra\s*hd\b|\buhd\b/i, "4K Ultra HD"],
      [/\bfull\s*hd\b|\bfhd\b|1920\s*x\s*1080/i, "Full HD"],
      [/\bhd\s*ready\b|1366\s*x\s*768/i, "HD Ready"],
    ]),
  },
  {
    key: "smartFeatures",
    label: "Features",
    specKeys: ["features", "special features", "smart features"],
    extract: keywordExtractor([
      [/\bsmart\s*tv\b|\bsmart\b/i, "Smart"],
      [/\bgoogle\s*tv\b/i, "Google TV"],
      [/\bandroid\b/i, "Android"],
      [/\bdolby\b/i, "Dolby"],
      [/\bhdr\b/i, "HDR"],
      [/\b5\s*g\b/i, "5G"],
      [/\binverter\b/i, "Inverter"],
      [/\bwi-?fi\b/i, "Wi-Fi"],
      [/\bfrost\s*free\b/i, "Frost Free"],
      [/\bconvertible\b/i, "Convertible"],
      [/\bgaming\b/i, "Gaming"],
    ]),
  },
  {
    key: "doorType",
    label: "Door Type",
    specKeys: ["door type", "configuration", "type"],
    extract: keywordExtractor([
      [/\bside\s*by\s*side\b/i, "Side by Side"],
      [/\bfrench\s*door\b/i, "French Door"],
      [/\btriple\s*door\b/i, "Triple Door"],
      [/\bdouble\s*door\b|\bdual\s*door\b/i, "Double Door"],
      [/\bsingle\s*door\b/i, "Single Door"],
    ]),
  },
  {
    key: "loadType",
    label: "Load Type",
    specKeys: ["load type", "washing method", "type"],
    extract: keywordExtractor([
      [/\bfront\s*load\b/i, "Front Load"],
      [/\btop\s*load\b/i, "Top Load"],
      [/\bsemi[\s-]*automatic\b/i, "Semi Automatic"],
      [/\bfully[\s-]*automatic\b/i, "Fully Automatic"],
    ]),
  },
  {
    key: "ram",
    label: "RAM",
    specKeys: ["ram", "memory", "ram size"],
    sort: numericSort,
    extract: (text) => {
      const match = text.match(/\b(\d{1,2})\s*gb\s*(?:ram|memory)\b/i)
      return match ? [`${match[1]} GB`] : []
    },
  },
  {
    key: "storage",
    label: "Storage",
    specKeys: ["storage", "internal storage", "hard drive size", "ssd"],
    sort: numericSort,
    extract: (text) => {
      const tb = text.match(/\b(\d)\s*tb\b/i)
      if (tb) return [`${Number(tb[1]) * 1024} GB`]
      const gb = text.match(/\b(\d{2,4})\s*gb\s*(?:storage|ssd|hdd|rom)?\b/i)
      if (!gb) return []
      const size = Number(gb[1])
      return size >= 32 ? [`${size} GB`] : []
    },
  },
  {
    key: "network",
    label: "5G Support",
    specKeys: ["network", "network type", "connectivity", "sim type"],
    extract: (text) => {
      if (/\b5\s*g\b/i.test(text)) return ["5G"]
      if (/\b4\s*g\b|\blte\b/i.test(text)) return ["4G"]
      return []
    },
  },
  {
    key: "battery",
    label: "Battery Capacity",
    specKeys: ["battery", "battery capacity", "battery size"],
    extract: (text) => {
      const match = text.match(/\b(\d{3,5})\s*mah\b/i)
      if (!match) return []
      const mah = Number(match[1])
      if (mah < 2000 || mah > 8000) return []
      if (mah < 4000) return ["Under 4000 mAh"]
      if (mah < 5000) return ["4000–5000 mAh"]
      return ["5000 mAh & above"]
    },
  },
  {
    key: "operatingSystem",
    label: "Operating System",
    specKeys: ["operating system", "os", "platform"],
    extract: keywordExtractor([
      [/\bios\b|\biphone\b|\bipad\b/i, "iOS"],
      [/\bandroid\b/i, "Android"],
      [/\bwindows\b/i, "Windows"],
      [/\btizen\b/i, "Tizen"],
    ]),
  },
]

/** Everything on a product that might carry a spec, flattened to one string. */
function productText(product: FacetProduct): string {
  const parts: string[] = [
    String(product?.name || ""),
    String(product?.char_desc || product?.charDesc || ""),
    String(product?.type || ""),
    String(product?.subCategory || ""),
  ]

  const details = product?.technical_details
  if (details && typeof details === "object" && !Array.isArray(details)) {
    for (const [key, value] of Object.entries(details)) {
      if (value === null || value === undefined) continue
      parts.push(`${key} ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    }
  }

  if (Array.isArray(product?.features)) parts.push(product.features.join(" "))

  return parts.filter(Boolean).join(" | ")
}

/** Prefer an explicit spec key over anything scraped out of the name. */
function specValueFor(product: FacetProduct, definition: FacetDefinition): string[] {
  const details = product?.technical_details
  if (!details || typeof details !== "object" || Array.isArray(details)) return []

  for (const [key, value] of Object.entries(details)) {
    const normalizedKey = key.toLowerCase().replace(/[_-]+/g, " ").trim()
    if (!definition.specKeys.includes(normalizedKey)) continue
    const extracted = definition.extract(String(value))
    if (extracted.length > 0) return extracted
  }

  return []
}

/** Normalised facet values for a single product. */
export function facetValuesFor(product: FacetProduct): Record<string, string[]> {
  const text = productText(product)
  const result: Record<string, string[]> = {}

  for (const definition of FACET_DEFINITIONS) {
    const values = specValueFor(product, definition)
    const resolved = values.length > 0 ? values : definition.extract(text)
    if (resolved.length > 0) result[definition.key] = resolved
  }

  return result
}

/**
 * Build the facet list for a result set.
 *
 * A facet with a single value cannot narrow anything, so it is dropped — that
 * is what stops a TV category showing an empty "Load Type" filter.
 */
export function buildFacets(products: FacetProduct[], minValues = 2): Facet[] {
  const counters = new Map<string, Map<string, number>>()

  for (const product of products) {
    const values = facetValuesFor(product)
    for (const [key, list] of Object.entries(values)) {
      let bucket = counters.get(key)
      if (!bucket) {
        bucket = new Map<string, number>()
        counters.set(key, bucket)
      }
      for (const value of list) bucket.set(value, (bucket.get(value) || 0) + 1)
    }
  }

  const facets: Facet[] = []

  for (const definition of FACET_DEFINITIONS) {
    const bucket = counters.get(definition.key)
    if (!bucket || bucket.size < minValues) continue

    const values = Array.from(bucket, ([value, count]) => ({ value, count })).sort((a, b) =>
      definition.sort ? definition.sort(a.value, b.value) : a.value.localeCompare(b.value),
    )

    facets.push({ key: definition.key, label: definition.label, values })
  }

  return facets
}

/** Values within a facet are OR-ed; separate facets are AND-ed. */
export function matchesFacets(product: FacetProduct, selection: FacetSelection): boolean {
  return matchesFacetValues(facetValuesFor(product), selection)
}

/**
 * The same test against values that have already been extracted.
 *
 * `facetValuesFor` runs a dozen regexes over a concatenation of the name, spec
 * keys and features, so re-deriving it per candidate makes counting every
 * facet separately far too slow. Listing pages extract once and reuse.
 *
 * `exceptKey` leaves one facet out of the test. Counts for a facet have to
 * ignore that facet's own selection, otherwise picking "4K" reports every other
 * resolution as (0) and no second value can ever be added to an OR-ed group.
 */
export function matchesFacetValues(
  values: Record<string, string[]>,
  selection: FacetSelection,
  exceptKey?: string,
): boolean {
  for (const [key, chosen] of Object.entries(selection)) {
    if (chosen.length === 0 || key === exceptKey) continue
    const owned = values[key]
    if (!owned || !chosen.some((value) => owned.includes(value))) return false
  }
  return true
}

/**
 * Facets counted against the current selection.
 *
 * Each facet is counted over the products matching every *other* facet, so the
 * numbers answer "how many would I have if I picked this" rather than
 * restating what is already chosen.
 */
export function buildSelectionAwareFacets(
  extracted: Array<Record<string, string[]>>,
  selection: FacetSelection,
  minValues = 2,
): Facet[] {
  const facets: Facet[] = []

  for (const definition of FACET_DEFINITIONS) {
    const bucket = new Map<string, number>()

    for (const values of extracted) {
      if (!matchesFacetValues(values, selection, definition.key)) continue
      const owned = values[definition.key]
      if (!owned) continue
      for (const value of owned) bucket.set(value, (bucket.get(value) || 0) + 1)
    }

    // A facet the shopper has already used stays on screen even if it has
    // narrowed to a single value, because otherwise the control that undoes
    // the choice disappears along with it.
    const inUse = (selection[definition.key]?.length ?? 0) > 0
    if (bucket.size === 0 || (bucket.size < minValues && !inUse)) continue

    const values = Array.from(bucket, ([value, count]) => ({ value, count })).sort((a, b) =>
      definition.sort ? definition.sort(a.value, b.value) : a.value.localeCompare(b.value),
    )

    facets.push({ key: definition.key, label: definition.label, values })
  }

  return facets
}

/**
 * Phone filters, in the order the Mobile listing sidebar shows them.
 *
 * Values come only from the product's `specifications` sheet. A facet with
 * fewer than two real values is omitted, so "Type" disappears when every
 * phone is a smartphone and "Speciality" disappears when the sheet has no
 * such column.
 */
const MOBILE_SPEC_FACETS: Array<{
  key: string
  label: string
  specKeys: string[]
  normalize: (raw: string) => string[]
  sort?: (a: string, b: string) => number
}> = [
  { key: "ram", label: "RAM", specKeys: ["ram"], sort: numericSort, normalize: (raw) => gigabytes(raw) },
  { key: "networkType", label: "Network Type", specKeys: ["network type"], sort: orderOf(["5G", "4G", "3G", "2G"]), normalize: networks },
  { key: "internalStorage", label: "Internal Storage", specKeys: ["internal storage"], sort: memorySort, normalize: storageLabel },
  { key: "processorBrand", label: "Processor Brand", specKeys: ["processor brand"], normalize: shortLabel },
  { key: "operatingSystem", label: "Operating System", specKeys: ["operating system"], sort: orderOf(["Android", "iOS", "HarmonyOS"]), normalize: operatingSystem },
  { key: "batteryCapacity", label: "Battery Capacity", specKeys: ["battery capacity"], sort: numericSort, normalize: (raw) => {
    const match = raw.match(/(\d{3,5})\s*mah/i)
    return match ? [`${match[1]} mAh`] : []
  } },
  { key: "resolutionType", label: "Resolution Type", specKeys: ["resolution type"], normalize: shortLabel },
  { key: "speciality", label: "Speciality", specKeys: ["speciality", "specialty"], normalize: shortLabel },
  { key: "clockSpeed", label: "Clock Speed", specKeys: ["primary clock speed", "clock speed"], sort: numericSort, normalize: (raw) => {
    const match = raw.match(/(\d+(?:\.\d+)?)\s*ghz/i)
    return match ? [`${match[1]} GHz`] : []
  } },
  { key: "phoneType", label: "Type", specKeys: ["browse type", "type"], normalize: shortLabel },
  { key: "primaryCamera", label: "Primary Camera", specKeys: ["primary camera"], sort: numericSort, normalize: megapixels },
  { key: "screenSize", label: "Screen Size", specKeys: ["display size", "screen size"], sort: numericSort, normalize: phoneInches },
  { key: "simType", label: "SIM Type", specKeys: ["sim type"], normalize: shortLabel },
  { key: "coreCount", label: "Number of Cores", specKeys: ["processor core", "number of cores"], sort: orderOf(["Single Core", "Dual Core", "Quad Core", "Hexa Core", "Octa Core", "Deca Core"]), normalize: shortLabel },
  { key: "secondaryCamera", label: "Secondary Camera", specKeys: ["secondary camera"], sort: numericSort, normalize: megapixels },
]

export const MOBILE_FACETS_BEFORE_RATING = [
  "ram", "networkType", "internalStorage", "processorBrand", "operatingSystem",
  "batteryCapacity", "resolutionType", "speciality", "clockSpeed", "phoneType",
  "primaryCamera", "screenSize", "simType",
] as const

export const MOBILE_FACETS_AFTER_RATING = ["coreCount", "secondaryCamera"] as const

function orderOf(order: string[]) {
  return (a: string, b: string) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  }
}

function memorySort(a: string, b: string) {
  const bytes = (value: string) => {
    const amount = parseFloat(value)
    return /tb/i.test(value) ? amount * 1024 : amount
  }
  return bytes(a) - bytes(b)
}

function shortLabel(raw: string): string[] {
  const value = raw.replace(/\s+/g, " ").trim()
  if (!value || value.length > 60 || /^(yes|no|true|false|n\/?a|-)$/i.test(value)) return []
  return [value]
}

function gigabytes(raw: string): string[] {
  const match = raw.match(/(\d+(?:\.\d+)?)\s*gb/i)
  return match ? [`${match[1]} GB`] : []
}

function storageLabel(raw: string): string[] {
  const terabytes = raw.match(/(\d+(?:\.\d+)?)\s*tb/i)
  if (terabytes) return [`${terabytes[1]} TB`]
  const gigabytesMatch = raw.match(/(\d+)\s*gb/i)
  if (!gigabytesMatch) return []
  const amount = Number(gigabytesMatch[1])
  if (amount >= 1024 && amount % 1024 === 0) return [`${amount / 1024} TB`]
  return amount >= 16 ? [`${amount} GB`] : []
}

function networks(raw: string): string[] {
  const found: string[] = []
  if (/5\s*g/i.test(raw)) found.push("5G")
  if (/4\s*g|\bvolte\b|\blte\b/i.test(raw)) found.push("4G")
  if (/3\s*g/i.test(raw)) found.push("3G")
  if (/2\s*g/i.test(raw)) found.push("2G")
  return found
}

function operatingSystem(raw: string): string[] {
  if (/\bios\b/i.test(raw)) return ["iOS"]
  if (/\bandroid\b/i.test(raw)) return ["Android"]
  if (/\bharmony/i.test(raw)) return ["HarmonyOS"]
  return shortLabel(raw.split(/\s+/)[0] || "")
}

function megapixels(raw: string): string[] {
  const match = raw.match(/(\d+)\s*mp/i)
  return match ? [`${match[1]} MP`] : []
}

function phoneInches(raw: string): string[] {
  const match = raw.match(/\(\s*(\d+(?:\.\d+)?)\s*inch/i) || raw.match(/(\d+(?:\.\d+)?)\s*(?:inch|")/i)
  if (!match) return []
  const inches = Number(match[1])
  if (inches < 4 || inches > 8) return []
  return [`${Number(inches.toFixed(2))} inch`]
}

function specificationText(product: FacetProduct, keys: string[]): string {
  const specs = product.specifications
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return ""
  for (const [key, value] of Object.entries(specs)) {
    const normalized = key.toLowerCase().replace(/[_-]+/g, " ").trim()
    if (!keys.includes(normalized) || value == null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ""
}

/** Spec-sheet values for the Mobile listing filters. */
export function mobileFacetValuesFor(product: FacetProduct): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const definition of MOBILE_SPEC_FACETS) {
    const raw = specificationText(product, definition.specKeys)
    if (!raw) continue
    const values = definition.normalize(raw)
    if (values.length > 0) result[definition.key] = values
  }
  return result
}

/** Mobile spec facets that can actually narrow the current result set. */
export function buildMobileFacets(
  extracted: Array<Record<string, string[]>>,
  selection: FacetSelection,
  minValues = 2,
): Facet[] {
  const facets: Facet[] = []

  for (const definition of MOBILE_SPEC_FACETS) {
    const bucket = new Map<string, number>()
    for (const values of extracted) {
      if (!matchesFacetValues(values, selection, definition.key)) continue
      const owned = values[definition.key]
      if (!owned) continue
      for (const value of owned) bucket.set(value, (bucket.get(value) || 0) + 1)
    }

    const inUse = (selection[definition.key]?.length ?? 0) > 0
    if (bucket.size === 0 || (bucket.size < minValues && !inUse)) continue

    const values = Array.from(bucket, ([value, count]) => ({ value, count })).sort((a, b) =>
      definition.sort ? definition.sort(a.value, b.value) : a.value.localeCompare(b.value),
    )
    facets.push({ key: definition.key, label: definition.label, values })
  }

  return facets
}

export function countActiveFacets(selection: FacetSelection): number {
  return Object.values(selection).reduce((sum, values) => sum + values.length, 0)
}

export function toggleFacetValue(
  selection: FacetSelection,
  key: string,
  value: string,
): FacetSelection {
  const current = selection[key] || []
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]

  const updated = { ...selection, [key]: next }
  if (next.length === 0) delete updated[key]
  return updated
}
