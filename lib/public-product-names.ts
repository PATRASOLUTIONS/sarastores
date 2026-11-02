import { groupAdminProductNames } from "@/lib/admin-product-name-groups"

interface NamedProduct {
  id: string
  name?: unknown
  stock?: unknown
  active?: unknown
  updatedAt?: unknown
  raw?: unknown
}

function updatedAt(value: unknown): string | undefined {
  if (typeof value === "string") return value
  if (value instanceof Date || typeof value === "number") {
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
  }
  return undefined
}

/** Also guards older browser-cached lists. Preserve the original product objects. */
export function uniquePublicProductNames<T extends NamedProduct>(products: T[]): T[] {
  const groups = groupAdminProductNames(products.map(product => ({
    id: product.id,
    name: typeof product.name === "string" ? product.name : undefined,
    raw: product.raw && typeof product.raw === "object" && !Array.isArray(product.raw)
      ? product.raw as Record<string, unknown> : undefined,
    stock: product.stock,
    active: product.active === undefined ? true : product.active === true,
    updatedAt: updatedAt(product.updatedAt),
    original: product,
  })))
  return [...groups.values()].map(group => group[0].original)
}

