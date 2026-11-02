import { normalizeProductForSchema, type ProductSchemaInput } from "@/lib/product-schema"
import { stockItemAliases } from "@/lib/stock-item-code"

export interface AdminNameProduct extends ProductSchemaInput {
  id: string
  groupingName?: string
  stock?: unknown
  active?: boolean
  updatedAt?: string
}

export function adminProductNameKey(product: AdminNameProduct): string {
  const name = (product.groupingName ?? normalizeProductForSchema(product).name)
    .normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
  // Missing names are separate records, never a shared "Unnamed Product" group.
  return name ? `name:${name}` : `id:${product.id}`
}

export function adminDisplayStock(product: AdminNameProduct): number {
  const value = product.stock
  const stock = typeof value === "number" || typeof value === "string" ? Number(value) : 0
  return Number.isFinite(stock) && stock > 0 ? stock : 0
}

function updatedTime(product: AdminNameProduct): number {
  const time = product.updatedAt ? Date.parse(product.updatedAt) : 0
  return Number.isFinite(time) ? time : 0
}

/** Stock first; ties prefer active, newest update, then a stable record ID. */
export function compareAdminNameRecords(a: AdminNameProduct, b: AdminNameProduct): number {
  return adminDisplayStock(b) - adminDisplayStock(a)
    || Number(b.active ?? true) - Number(a.active ?? true)
    || updatedTime(b) - updatedTime(a)
    || a.id.localeCompare(b.id)
}

export function groupAdminProductNames<T extends AdminNameProduct>(products: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const product of products) {
    const key = adminProductNameKey(product)
    const group = groups.get(key)
    if (group) group.push(product)
    else groups.set(key, [product])
  }
  for (const group of groups.values()) group.sort(compareAdminNameRecords)
  return groups
}

/** Input has search/taxonomy/status filters applied; stock is filtered after grouping. */
export function selectAdminNameRows<T extends AdminNameProduct>(products: T[], options: {
  enabled: boolean
  search: string
  stock: "all" | "in" | "out"
}) {
  const term = options.search.trim().toUpperCase()
  const exact = term ? products.filter(product => stockItemAliases({ ...product, raw: product.raw ?? undefined })
    .some(code => code.toUpperCase() === term)) : []
  const exactItemSearch = exact.length > 0
  const candidates = options.enabled && exactItemSearch ? exact : products
  const selected = options.enabled && !exactItemSearch
    ? [...groupAdminProductNames(candidates).values()].map(group => group[0])
    : candidates
  const rows = selected.filter(product => options.stock === "all"
    || (options.stock === "in" ? adminDisplayStock(product) > 0 : adminDisplayStock(product) === 0))
  return { rows, exactItemSearch, hiddenAlternatives: candidates.length - selected.length }
}
