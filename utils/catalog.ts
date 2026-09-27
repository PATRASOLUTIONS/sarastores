/**
 * Catalogue taxonomy helpers.
 *
 * Sub-category values are entered inconsistently ("REFRIGERATOR" vs "Refrigerators",
 * televisions split across "TV 32" … "TV 75\"" and "Smart Televisions"), and the
 * `category` field holds internal warehouse labels ("PANEL" means televisions).
 * These helpers map the raw data onto labels a shopper would recognise.
 */

export type CatalogProduct = Record<string, any>

const CATEGORY_RULES: Array<{ match: RegExp; label: string }> = [
  { match: /washing\s*machine|washer/i, label: "Washing Machines" },
  { match: /refrigerator|fridge/i, label: "Refrigerators" },
  { match: /television|smart\s*tv|(^|\s)tv(\s|$|\d|")/i, label: "Televisions" },
  { match: /air\s*cool/i, label: "Air Coolers" },
  { match: /air\s*condition|(^|\s)ac(\s|$)/i, label: "Air Conditioners" },
  { match: /microwave|oven/i, label: "Microwaves & Ovens" },
  { match: /geyser|water\s*heater/i, label: "Water Heaters" },
  { match: /purifier/i, label: "Water Purifiers" },
  { match: /dishwash/i, label: "Dishwashers" },
]

/** Shopper-facing category for a product, or null when it can't be classified. */
export function categoryOf(product: CatalogProduct): string | null {
  const haystack = [product?.subCategory, product?.category, product?.name]
    .filter(Boolean)
    .join(" ")
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(haystack)) return rule.label
  }
  return null
}

/** `manufacturerName` is the most reliable brand source; fall back to the title's first word. */
export function brandOf(product: CatalogProduct): string | null {
  const raw =
    product?.manufacturerName ||
    product?.manufacturer_name ||
    (product?.name || "").trim().split(/\s+/)[0]
  if (!raw || String(raw).length < 2) return null
  const value = String(raw).trim()
  // The `brand` field is polluted with warehouse labels, so reject those.
  if (/^(home appliances|panel|small appliance|electronics)$/i.test(value)) return null
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function isInStock(product: CatalogProduct): boolean {
  return typeof product?.stock === "number" ? product.stock > 0 : true
}

export type Rail = {
  id: string
  title: string
  subtitle: string
  href: string
  products: CatalogProduct[]
}

const MIN_RAIL_SIZE = 6
const RAIL_LIMIT = 14

/** Category rails, ordered by how much stock backs them. */
export function buildCategoryRails(products: CatalogProduct[]): Rail[] {
  const buckets = new Map<string, CatalogProduct[]>()
  products.filter(isInStock).forEach((p) => {
    const cat = categoryOf(p)
    if (!cat) return
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat)!.push(p)
  })

  return Array.from(buckets.entries())
    .filter(([, items]) => items.length >= MIN_RAIL_SIZE)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([label, items]) => ({
      id: `cat-${label.toLowerCase().replace(/\W+/g, "-")}`,
      title: label,
      subtitle: `${items.length} options in stock`,
      href: `/products?q=${encodeURIComponent(label)}`,
      products: items.slice(0, RAIL_LIMIT),
    }))
}

/** Price-band rails give the page depth that the narrow catalogue can't supply on its own. */
export function buildPriceRails(products: CatalogProduct[]): Rail[] {
  const inStock = products.filter(isInStock)
  const bands = [
    { id: "under-20k", title: "Great finds under ₹20,000", max: 20000, min: 0 },
    { id: "premium", title: "Premium picks above ₹60,000", max: Infinity, min: 60000 },
  ]

  return bands
    .map(({ id, title, min, max }) => {
      const items = inStock
        .filter((p) => Number(p.price) > min && Number(p.price) <= max)
        .sort((a, b) => (min === 0 ? a.price - b.price : b.price - a.price))
      return {
        id,
        title,
        subtitle: `${items.length} products`,
        href: "/products",
        products: items.slice(0, RAIL_LIMIT),
      }
    })
    .filter((r) => r.products.length >= MIN_RAIL_SIZE)
}

/** Brands that actually have stock behind them, for the brand strip. */
export function buildBrandList(products: CatalogProduct[], limit = 10) {
  const counts = new Map<string, number>()
  products.filter(isInStock).forEach((p) => {
    const b = brandOf(p)
    if (!b) return
    counts.set(b, (counts.get(b) || 0) + 1)
  })
  return Array.from(counts.entries())
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

export type CategoryTile = {
  label: string
  count: number
  image: string
  href: string
}

/** Large category tiles, each illustrated by its best-selling looking product. */
export function buildCategoryTiles(products: CatalogProduct[], limit = 6): CategoryTile[] {
  const buckets = new Map<string, CatalogProduct[]>()
  products.filter(isInStock).forEach((p) => {
    const cat = categoryOf(p)
    if (!cat) return
    if (!buckets.has(cat)) buckets.set(cat, [])
    buckets.get(cat)!.push(p)
  })

  return Array.from(buckets.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([label, items]) => {
      const hero = items.find((p) => p.image && !/placeholder/i.test(p.image))
      return {
        label,
        count: items.length,
        image: hero?.image || "/placeholder.svg",
        href: `/products?q=${encodeURIComponent(label)}`,
      }
    })
}

/**
 * Products for the spotlight banners. The discount is bounded on both sides:
 * too low isn't compelling, too high means the MRP is a data-entry error and
 * advertising it would look fraudulent.
 */
const SPOTLIGHT_MIN_PCT = 10
const SPOTLIGHT_MAX_PCT = 60

export function pickSpotlights(products: CatalogProduct[], count = 2): CatalogProduct[] {
  return products
    .filter((p) => {
      if (!isInStock(p) || !p.image || /placeholder/i.test(p.image)) return false
      const price = Number(p.price)
      const mrp = Number(p.mrp)
      if (!(price > 0) || !(mrp > price)) return false
      const pct = Math.round(((mrp - price) / mrp) * 100)
      return pct >= SPOTLIGHT_MIN_PCT && pct <= SPOTLIGHT_MAX_PCT
    })
    .sort((a, b) => Number(b.mrp) - Number(b.price) - (Number(a.mrp) - Number(a.price)))
    .slice(0, count)
}
