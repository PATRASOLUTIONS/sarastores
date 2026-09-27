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
]

/** Everything on a product that might carry a spec, flattened to one string. */
function productText(product: any): string {
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
function specValueFor(product: any, definition: FacetDefinition): string[] {
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
export function facetValuesFor(product: any): Record<string, string[]> {
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
export function buildFacets(products: any[], minValues = 2): Facet[] {
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
export function matchesFacets(product: any, selection: FacetSelection): boolean {
  const active = Object.entries(selection).filter(([, values]) => values.length > 0)
  if (active.length === 0) return true

  const productValues = facetValuesFor(product)

  return active.every(([key, values]) => {
    const owned = productValues[key]
    return !!owned && values.some((value) => owned.includes(value))
  })
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
