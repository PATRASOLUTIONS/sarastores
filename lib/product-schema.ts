export const PRODUCT_CANONICAL_COLUMNS = {
  sku: "itemno",
  name: "Name",
  description: "Description",
  charDesc: "CHAR DESC",
  categoryGroupName: "Category/Group Name",
  subCategoryProdDesc: "sub-category/PROD DESC",
  manufacturerName: "Manufacturer Name",
} as const

const COLUMN_ALIASES: Record<keyof typeof PRODUCT_CANONICAL_COLUMNS, string[]> = {
  sku: [
    "itemno",
    "Item No.",
    "Item No",
    "item no",
    "ItemNo",
    "ITEMNO",
    "item_no",
    "SKU",
    "sku",
    "Sku",
  ],
  name: ["Name", "name", "NAME", "Product Name", "Item Description"],
  description: ["Description", "description", "DESCRIPTION", "Product Description"],
  charDesc: ["CHAR DESC", "Char Desc", "char desc", "Characteristics", "CHARDESC"],
  categoryGroupName: [
    "Category/Group Name",
    "Category",
    "category",
    "CATEGORY",
    "Group Name",
    "group name",
    "GroupName",
    "groupName",
    "ITEM CATEGORY",
  ],
  subCategoryProdDesc: [
    "sub-category/PROD DESC",
    "Sub-Category/PROD DESC",
    "sub-category",
    "Sub-Category",
    "subcategory",
    "Subcategory",
    "SubCategory",
    "PROD DESC",
    "Prod Desc",
    "prod desc",
  ],
  manufacturerName: [
    "Manufacturer Name",
    "manufacturer name",
    "MANUFACTURER NAME",
    "ManufacturerName",
    "Manufacturer",
    "manufacturer",
  ],
}

export interface CanonicalProductMetadata {
  itemno: string
  name: string
  description: string
  charDesc: string
  categoryGroupName: string
  subCategoryProdDesc: string
  manufacturerName: string
}

function firstNonEmpty(...values: any[]): string {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue
    }

    const normalized = String(value).trim()
    if (normalized) {
      return normalized
    }
  }

  return ""
}

export function readAliasValue(source: Record<string, any>, aliases: string[]): string {
  for (const key of aliases) {
    const value = source[key]
    if (value === null || value === undefined) {
      continue
    }

    const normalized = String(value).trim()
    if (normalized) {
      return normalized
    }
  }

  return ""
}

export function extractCanonicalProductMetadata(row: Record<string, any>): CanonicalProductMetadata {
  return {
    itemno: readAliasValue(row, COLUMN_ALIASES.sku),
    name: readAliasValue(row, COLUMN_ALIASES.name),
    description: readAliasValue(row, COLUMN_ALIASES.description),
    charDesc: readAliasValue(row, COLUMN_ALIASES.charDesc),
    categoryGroupName: readAliasValue(row, COLUMN_ALIASES.categoryGroupName),
    subCategoryProdDesc: readAliasValue(row, COLUMN_ALIASES.subCategoryProdDesc),
    manufacturerName: readAliasValue(row, COLUMN_ALIASES.manufacturerName),
  }
}

export function normalizeProductForSchema(product: any): CanonicalProductMetadata {
  const raw = (product?.raw || {}) as Record<string, any>

  return {
    itemno: firstNonEmpty(product?.sku, product?.itemNo, product?.itemno, raw["itemno"], raw["Item No."], raw["Item No"], raw["ITEM NO"]),
    name: firstNonEmpty(product?.name, raw["Name"], raw["Item Description"]),
    description: firstNonEmpty(product?.description, raw["Description"]),
    charDesc: firstNonEmpty(product?.char_desc, product?.characteristics, raw["CHAR DESC"], raw["CHARDESC"]),
    categoryGroupName: firstNonEmpty(product?.groupName, product?.category, raw["Category/Group Name"], raw["Group Name"], raw["Category"], raw["ITEM CATEGORY"]),
    subCategoryProdDesc: firstNonEmpty(product?.subCategory, product?.prod_desc, raw["sub-category/PROD DESC"], raw["Sub-Category/PROD DESC"], raw["sub-category"], raw["PROD DESC"]),
    manufacturerName: firstNonEmpty(product?.manufacturerName, product?.manufacturer_name, product?.manufacturer, raw["Manufacturer Name"], raw["Manufacturer"]),
  }
}

export function buildSchemaSynchronizedRaw(rawInput: Record<string, any> | null | undefined, canonical: CanonicalProductMetadata) {
  const raw = { ...(rawInput || {}) }

  if (canonical.itemno) raw[PRODUCT_CANONICAL_COLUMNS.sku] = canonical.itemno
  if (canonical.name) raw[PRODUCT_CANONICAL_COLUMNS.name] = canonical.name
  if (canonical.description) raw[PRODUCT_CANONICAL_COLUMNS.description] = canonical.description
  if (canonical.charDesc) raw[PRODUCT_CANONICAL_COLUMNS.charDesc] = canonical.charDesc
  if (canonical.categoryGroupName) raw[PRODUCT_CANONICAL_COLUMNS.categoryGroupName] = canonical.categoryGroupName
  if (canonical.subCategoryProdDesc) raw[PRODUCT_CANONICAL_COLUMNS.subCategoryProdDesc] = canonical.subCategoryProdDesc
  if (canonical.manufacturerName) raw[PRODUCT_CANONICAL_COLUMNS.manufacturerName] = canonical.manufacturerName

  return raw
}
