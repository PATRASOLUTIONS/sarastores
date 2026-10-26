/** Shared catalogue identifiers for stock imports and server-side checkout. */
export interface StockCatalogueProduct {
  sku?: unknown; itemno?: unknown; itemNo?: unknown; raw?: Record<string, unknown>
}
const STOCK_ITEM_FIELDS = ["sku", "itemno", "itemNo", "raw.itemno", "raw.Item No", "raw.ITEM NO"]
const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
export const stockCodeKey = (value: string) => value.trim().toUpperCase()
export function stockItemAliases(product: StockCatalogueProduct): string[] {
  return [...new Set([product.sku, product.itemno, product.itemNo, product.raw?.itemno,
    product.raw?.["Item No."], product.raw?.["Item No"], product.raw?.["ITEM NO"]].map(text).filter(Boolean))]
}
export function stockItemCode(product: StockCatalogueProduct): string | null {
  return stockItemAliases(product)[0] || null
}
export function stockItemFilter(codes: string[]) {
  const values: (string | number)[] = [...new Set(codes.map(code => code.trim()))]
  for (const code of codes) if (/^(0|[1-9]\d*)$/.test(code) && Number.isSafeInteger(Number(code))) values.push(Number(code))
  return { $or: [
    ...STOCK_ITEM_FIELDS.map(field => ({ [field]: { $in: values } })),
    // The period in Excel's "Item No." is a literal key, not a MongoDB path.
    { $expr: { $in: [{ $getField: { field: "Item No.", input: {
      $cond: [{ $eq: [{ $type: "$raw" }, "object"] }, "$raw", {}],
    } } }, values] } },
  ] }
}
