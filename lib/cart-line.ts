export type CartLineIdentity = {
  saraCare?: { parentLineKey: string; durationYears: number } | null;
  id?: string; productId?: string; type?: string | null; sku?: string | null;
  variantId?: string | null; color?: string | null; size?: string | null;
  ram?: string | null; storage?: string | null; kgenVariantId?: string | null;
  packSize?: string | number | null; validityYears?: string | number | null;
}

/** Product identity stays unchanged; the key identifies one purchase option. */
export function cartLineKey(item: CartLineIdentity): string {
  const id = item.id || item.productId || ""
  const option = (value: unknown) => value == null ? "" : String(value).trim().toLowerCase()
  const options = [item.variantId, item.sku, item.color, item.size, item.ram, item.storage,
    item.kgenVariantId, item.packSize, item.validityYears].map(option)
  if (item.type === "software") options.push("software")
  if (item.saraCare) options.push("sara-care", item.saraCare.parentLineKey, String(item.saraCare.durationYears))
  return `${id}::${JSON.stringify(options)}`
}

export function findCartLine<T extends CartLineIdentity>(items: T[], target: string): T | undefined {
  const exact = items.find(item => cartLineKey(item) === target)
  if (exact) return exact
  const matches = items.filter(item => item.id === target)
  // An old product-id-only caller must never change all of its variants.
  return matches.length === 1 ? matches[0] : undefined
}
