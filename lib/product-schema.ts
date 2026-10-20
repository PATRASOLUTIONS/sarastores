/*
 * The catalogue's merchandising hierarchy is Division → Category → Segment:
 * "Electronics" → "Mobile Accessories" → "Chargers & Adapters". Those three
 * levels are what the header mega-menu renders — division as the tab, category
 * as the column heading, segment as the link — and what the storefront sidebar
 * filters on.
 *
 * `subCategoryProdDesc` (the warehouse PROD DESC column) predates that
 * hierarchy and is kept as a descriptive field: it is still shown in admin and
 * still drives existing storefront links, but it is not part of the menu.
 *
 * `brandName` is deliberately separate from both `categoryGroupName` and
 * `manufacturerName`. The bulk importer used to write the category value into
 * the product's `brand` field, so brand was never independently editable.
 */
export const PRODUCT_CANONICAL_COLUMNS = {
  sku: "itemno",
  name: "Name",
  description: "Description",
  charDesc: "CHAR DESC",
  division: "Division",
  categoryGroupName: "Category/Group Name",
  segment: "Segment",
  brandName: "Brand",
  subCategoryProdDesc: "sub-category/PROD DESC",
  manufacturerName: "Manufacturer Name",
} as const

/** The merchandising levels, broadest first. */
export const TAXONOMY_LEVELS = ["division", "categoryGroupName", "segment"] as const
export type TaxonomyLevel = (typeof TAXONOMY_LEVELS)[number]

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
  division: [
    "Division",
    "division",
    "DIVISION",
    "Item Division",
    "ITEM DIVISION",
    "item division",
    "Department",
    "department",
  ],
  segment: [
    "Segment",
    "segment",
    "SEGMENT",
    "Item Segment",
    "ITEM SEGMENT",
    "item segment",
    "Sub Segment",
    "sub segment",
  ],
  brandName: [
    "Brand",
    "brand",
    "BRAND",
    "Brand Name",
    "brand name",
    "BRAND NAME",
    "BrandName",
    "brandName",
  ],
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
  division: string
  categoryGroupName: string
  segment: string
  brandName: string
  subCategoryProdDesc: string
  manufacturerName: string
}

export interface ProductSchemaInput {
  raw?: Record<string, unknown> | null
  sku?: unknown
  itemNo?: unknown
  itemno?: unknown
  name?: unknown
  description?: unknown
  char_desc?: unknown
  characteristics?: unknown
  division?: unknown
  groupName?: unknown
  category?: unknown
  segment?: unknown
  brand?: unknown
  subCategory?: unknown
  prod_desc?: unknown
  manufacturerName?: unknown
  manufacturer_name?: unknown
  manufacturer?: unknown
}

function firstNonEmpty(...values: unknown[]): string {
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

export function readAliasValue(source: Record<string, unknown>, aliases: string[]): string {
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

export function extractCanonicalProductMetadata(row: Record<string, unknown>): CanonicalProductMetadata {
  return {
    itemno: readAliasValue(row, COLUMN_ALIASES.sku),
    name: readAliasValue(row, COLUMN_ALIASES.name),
    description: readAliasValue(row, COLUMN_ALIASES.description),
    charDesc: readAliasValue(row, COLUMN_ALIASES.charDesc),
    division: readAliasValue(row, COLUMN_ALIASES.division),
    categoryGroupName: readAliasValue(row, COLUMN_ALIASES.categoryGroupName),
    segment: readAliasValue(row, COLUMN_ALIASES.segment),
    brandName: readAliasValue(row, COLUMN_ALIASES.brandName),
    subCategoryProdDesc: readAliasValue(row, COLUMN_ALIASES.subCategoryProdDesc),
    manufacturerName: readAliasValue(row, COLUMN_ALIASES.manufacturerName),
  }
}

function isProductRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function normalizeProductForSchema(product: ProductSchemaInput | Record<string, unknown> | null | undefined): CanonicalProductMetadata {
  const raw = isProductRecord(product?.raw) ? product.raw : {}

  return {
    itemno: firstNonEmpty(product?.sku, product?.itemNo, product?.itemno, raw["itemno"], raw["Item No."], raw["Item No"], raw["ITEM NO"]),
    name: firstNonEmpty(product?.name, raw["Name"], raw["Item Description"]),
    description: firstNonEmpty(product?.description, raw["Description"]),
    charDesc: firstNonEmpty(product?.char_desc, product?.characteristics, raw["CHAR DESC"], raw["CHARDESC"]),
    division: firstNonEmpty(product?.division, raw["Division"], raw["DIVISION"], raw["Item Division"]),
    categoryGroupName: firstNonEmpty(product?.groupName, product?.category, raw["Category/Group Name"], raw["Group Name"], raw["Category"], raw["ITEM CATEGORY"]),
    segment: firstNonEmpty(product?.segment, raw["Segment"], raw["SEGMENT"], raw["Item Segment"]),
    // Brand has no manufacturer fallback: they are distinct columns, and
    // conflating them would make an unset brand look populated in admin.
    brandName: firstNonEmpty(product?.brand, raw["Brand"], raw["BRAND"], raw["Brand Name"]),
    subCategoryProdDesc: firstNonEmpty(product?.subCategory, product?.prod_desc, raw["sub-category/PROD DESC"], raw["Sub-Category/PROD DESC"], raw["sub-category"], raw["PROD DESC"]),
    manufacturerName: firstNonEmpty(product?.manufacturerName, product?.manufacturer_name, product?.manufacturer, raw["Manufacturer Name"], raw["Manufacturer"]),
  }
}

export function buildSchemaSynchronizedRaw(rawInput: Record<string, unknown> | null | undefined, canonical: CanonicalProductMetadata) {
  const raw = { ...(rawInput || {}) }

  if (canonical.itemno) raw[PRODUCT_CANONICAL_COLUMNS.sku] = canonical.itemno
  if (canonical.name) raw[PRODUCT_CANONICAL_COLUMNS.name] = canonical.name
  if (canonical.description) raw[PRODUCT_CANONICAL_COLUMNS.description] = canonical.description
  if (canonical.charDesc) raw[PRODUCT_CANONICAL_COLUMNS.charDesc] = canonical.charDesc
  if (canonical.division) raw[PRODUCT_CANONICAL_COLUMNS.division] = canonical.division
  if (canonical.categoryGroupName) raw[PRODUCT_CANONICAL_COLUMNS.categoryGroupName] = canonical.categoryGroupName
  if (canonical.segment) raw[PRODUCT_CANONICAL_COLUMNS.segment] = canonical.segment
  if (canonical.brandName) raw[PRODUCT_CANONICAL_COLUMNS.brandName] = canonical.brandName
  if (canonical.subCategoryProdDesc) raw[PRODUCT_CANONICAL_COLUMNS.subCategoryProdDesc] = canonical.subCategoryProdDesc
  if (canonical.manufacturerName) raw[PRODUCT_CANONICAL_COLUMNS.manufacturerName] = canonical.manufacturerName

  return raw
}
