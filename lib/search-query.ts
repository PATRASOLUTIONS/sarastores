/**
 * Natural-language search query parsing.
 *
 * The BRD requires the search box to understand shopper phrasing such as
 * "washing machine under 25000", "samsung 55 inch tv", "iphone under 50000"
 * and "5 star AC". This module turns a raw query into a structured intent so
 * both the suggestions API and the results page can filter on it instead of
 * doing a plain substring match, which returns nothing for those phrases.
 *
 * Pure and dependency-free so it can run on the server and in the browser.
 */

export interface ParsedSearchQuery {
  /** The original query, trimmed. */
  raw: string
  /** Query with all recognised modifiers removed — used for text matching. */
  text: string
  minPrice: number | null
  maxPrice: number | null
  /** Screen/appliance size in inches, e.g. "55 inch TV". */
  sizeInches: number | null
  /** BEE energy rating, e.g. "5 star AC". */
  starRating: number | null
  /** Appliance capacity, e.g. "7 kg washing machine", "1.5 ton AC". */
  capacity: { value: number; unit: "kg" | "ton" | "litre" } | null
  /** Recognised marketing keywords, e.g. "5g", "oled", "front load". */
  features: string[]
}

const FEATURE_KEYWORDS = [
  "5g",
  "4k",
  "8k",
  "oled",
  "qled",
  "led",
  "mini led",
  "smart",
  "android",
  "google tv",
  "dolby",
  "hdr",
  "amoled",
  "gaming",
  "inverter",
  "front load",
  "top load",
  "semi automatic",
  "fully automatic",
  "single door",
  "double door",
  "side by side",
  "frost free",
  "convertible",
  "wifi",
  "bluetooth",
]

/** "25k" → 25000, "1.5 lakh" → 150000, "25,000" → 25000. */
function parseAmount(value: string, suffix?: string): number | null {
  const amount = Number(value.replace(/,/g, ""))
  if (!Number.isFinite(amount)) return null

  const unit = (suffix || "").trim().toLowerCase()
  if (unit === "k") return amount * 1_000
  if (unit === "l" || unit === "lakh" || unit === "lac" || unit === "lakhs") return amount * 100_000
  if (unit === "cr" || unit === "crore" || unit === "crores") return amount * 10_000_000
  return amount
}

const AMOUNT = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(k|l|lakh|lacs?|lakhs|cr|crores?)?`

export function parseSearchQuery(input: string): ParsedSearchQuery {
  const raw = (input || "").trim()
  let text = raw.toLowerCase()

  let minPrice: number | null = null
  let maxPrice: number | null = null

  // "between 20000 and 40000" / "20000 to 40000"
  const between = text.match(
    new RegExp(String.raw`(?:between\s+)?(?:₹|rs\.?)?\s*${AMOUNT}\s*(?:to|-|and|–)\s*(?:₹|rs\.?)?\s*${AMOUNT}`, "i"),
  )
  if (between) {
    const low = parseAmount(between[1], between[2])
    const high = parseAmount(between[3], between[4])
    if (low !== null && high !== null) {
      minPrice = Math.min(low, high)
      maxPrice = Math.max(low, high)
      text = text.replace(between[0], " ")
    }
  }

  // "under 25000", "below ₹25k", "less than 25000", "upto 25000"
  if (maxPrice === null) {
    const under = text.match(
      new RegExp(String.raw`(?:under|below|less\s+than|upto|up\s+to|within)\s*(?:₹|rs\.?)?\s*${AMOUNT}`, "i"),
    )
    if (under) {
      maxPrice = parseAmount(under[1], under[2])
      text = text.replace(under[0], " ")
    }
  }

  // "above 30000", "over ₹30k", "more than 30000"
  if (minPrice === null) {
    const above = text.match(
      new RegExp(String.raw`(?:above|over|more\s+than|starting\s+(?:from|at)|from)\s*(?:₹|rs\.?)?\s*${AMOUNT}`, "i"),
    )
    if (above) {
      minPrice = parseAmount(above[1], above[2])
      text = text.replace(above[0], " ")
    }
  }

  // "55 inch", '55"', "55-inch"
  let sizeInches: number | null = null
  const size = text.match(/(\d{2,3})\s*(?:-\s*)?(?:inch(?:es)?|"|''|inc\b)/i)
  if (size) {
    sizeInches = Number(size[1])
    text = text.replace(size[0], " ")
  }

  // "5 star", "3-star"
  let starRating: number | null = null
  const star = text.match(/([1-5])\s*(?:-\s*)?star/i)
  if (star) {
    starRating = Number(star[1])
    text = text.replace(star[0], " ")
  }

  // "7 kg", "1.5 ton", "265 litre"
  let capacity: ParsedSearchQuery["capacity"] = null
  const cap = text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilo(?:gram)?s?|ton(?:ne)?s?|tr|l|ltr|litre?s?|liters?)\b/i)
  if (cap) {
    const value = Number(cap[1])
    const unitRaw = cap[2].toLowerCase()
    const unit: "kg" | "ton" | "litre" = unitRaw.startsWith("k")
      ? "kg"
      : unitRaw.startsWith("t")
        ? "ton"
        : "litre"
    if (Number.isFinite(value)) {
      capacity = { value, unit }
      text = text.replace(cap[0], " ")
    }
  }

  const normalizedForFeatures = ` ${text} `
  const features = FEATURE_KEYWORDS.filter((keyword) =>
    normalizedForFeatures.includes(` ${keyword} `),
  )

  text = text.replace(/[₹]/g, " ").replace(/\s+/g, " ").trim()

  return { raw, text, minPrice, maxPrice, sizeInches, starRating, capacity, features }
}

/** True when the query carried something beyond plain keywords. */
export function hasStructuredIntent(parsed: ParsedSearchQuery): boolean {
  return (
    parsed.minPrice !== null ||
    parsed.maxPrice !== null ||
    parsed.sizeInches !== null ||
    parsed.starRating !== null ||
    parsed.capacity !== null ||
    parsed.features.length > 0
  )
}

/** Human-readable summary for the results header, e.g. "under ₹25,000 · 55 inch". */
export function describeSearchQuery(parsed: ParsedSearchQuery): string {
  const inr = (value: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)

  const parts: string[] = []
  if (parsed.minPrice !== null && parsed.maxPrice !== null) {
    parts.push(`${inr(parsed.minPrice)} – ${inr(parsed.maxPrice)}`)
  } else if (parsed.maxPrice !== null) {
    parts.push(`under ${inr(parsed.maxPrice)}`)
  } else if (parsed.minPrice !== null) {
    parts.push(`above ${inr(parsed.minPrice)}`)
  }

  if (parsed.sizeInches !== null) parts.push(`${parsed.sizeInches} inch`)
  if (parsed.starRating !== null) parts.push(`${parsed.starRating} star`)
  if (parsed.capacity) parts.push(`${parsed.capacity.value} ${parsed.capacity.unit}`)
  parts.push(...parsed.features)

  return parts.join(" · ")
}

/** Convert the parsed intent into `/products` query-string parameters. */
export function toProductSearchParams(parsed: ParsedSearchQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (parsed.text) params.set("q", parsed.text)
  if (parsed.minPrice !== null) params.set("minPrice", String(parsed.minPrice))
  if (parsed.maxPrice !== null) params.set("maxPrice", String(parsed.maxPrice))
  if (parsed.sizeInches !== null) params.set("size", String(parsed.sizeInches))
  if (parsed.starRating !== null) params.set("star", String(parsed.starRating))
  if (parsed.capacity) params.set("capacity", `${parsed.capacity.value}${parsed.capacity.unit}`)
  for (const feature of parsed.features) params.append("feature", feature)
  return params
}

/**
 * Mongo filter for the structured half of a query. The text half is matched
 * separately so callers can choose regex, `$text`, or Atlas Search.
 */
export function toMongoFilter(parsed: ParsedSearchQuery): Record<string, unknown> {
  const filter: Record<string, unknown> = {}

  if (parsed.minPrice !== null || parsed.maxPrice !== null) {
    const price: Record<string, number> = {}
    if (parsed.minPrice !== null) price.$gte = parsed.minPrice
    if (parsed.maxPrice !== null) price.$lte = parsed.maxPrice
    filter.price = price
  }

  // Size, star rating and features are not first-class columns, so they are
  // matched against the product name and spec blob.
  const tokens: string[] = []
  if (parsed.sizeInches !== null) tokens.push(String(parsed.sizeInches))
  if (parsed.starRating !== null) tokens.push(`${parsed.starRating} star`)
  if (parsed.capacity) tokens.push(`${parsed.capacity.value}`)
  tokens.push(...parsed.features)

  if (tokens.length > 0) {
    filter.$and = tokens.map((token) => {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const rx = new RegExp(escaped, "i")
      return { $or: [{ name: rx }, { description: rx }, { char_desc: rx }] }
    })
  }

  return filter
}
