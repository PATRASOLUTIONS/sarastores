/*
 * The bulk metadata sheet: the six columns an operator edits to classify the
 * catalogue, and nothing else.
 *
 * The warehouse export names its columns one level below where they actually
 * read. What it calls "Category/Group Name" is the division, what it calls
 * "sub-category/PROD DESC" is the category, "CHAR DESC" is the segment, and
 * "Manufacturer Name" is the brand. The sheet therefore uses the merchandising
 * names and accepts the warehouse spellings as aliases, so an export taken
 * straight out of the ERP still imports into the right levels.
 *
 * This is deliberately separate from `lib/product-schema.ts`. That module is
 * the whole-catalogue contract, read by about thirty files that still need
 * `charDesc`, `manufacturerName` and `subCategoryProdDesc`; narrowing it would
 * break them. This one describes a single spreadsheet.
 */

export const METADATA_SHEET_COLUMNS = {
  itemno: "itemno",
  name: "Name",
  division: "Division",
  category: "Category",
  segment: "Segment",
  brand: "Brand",
} as const

export type MetadataSheetField = keyof typeof METADATA_SHEET_COLUMNS

export type MetadataSheetRow = Record<MetadataSheetField, string>

/** Column order in the downloaded sheet: identify the item, then place it. */
export const METADATA_SHEET_FIELDS: MetadataSheetField[] = [
  "itemno",
  "name",
  "division",
  "category",
  "segment",
  "brand",
]

/** Everything except the match key. A row setting none of these is a no-op. */
export const METADATA_SHEET_EDITABLE_FIELDS: MetadataSheetField[] = [
  "name",
  "division",
  "category",
  "segment",
  "brand",
]

/**
 * Accepted spellings per column, most specific first.
 *
 * The warehouse headers are listed against the level they really describe, not
 * the one they are named after — that correction is the whole point of this
 * module. Note the one genuine ambiguity: a bare "Category" means the category
 * level here, while "Category/Group Name" means the division. A sheet carrying
 * both resolves correctly; a legacy sheet carrying only "Category" lands one
 * level low and has to be corrected by hand.
 */
const COLUMN_ALIASES: Record<MetadataSheetField, string[]> = {
  itemno: [
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
  division: [
    "Division",
    "division",
    "DIVISION",
    "Item Division",
    "Department",
    "Category/Group Name",
    "Group Name",
    "group name",
    "ITEM CATEGORY",
  ],
  category: [
    "Category",
    "category",
    "CATEGORY",
    "Sub Category",
    "sub category",
    "Sub-Category",
    "sub-category",
    "Subcategory",
    "subcategory",
    "sub-category/PROD DESC",
    "Sub-Category/PROD DESC",
    "PROD DESC",
    "Prod Desc",
  ],
  segment: [
    "Segment",
    "segment",
    "SEGMENT",
    "Item Segment",
    "CHAR DESC",
    "Char Desc",
    "char desc",
    "CHARDESC",
    "Characteristics",
  ],
  brand: [
    "Brand",
    "brand",
    "BRAND",
    "Brand Name",
    "brand name",
    "Manufacturer Name",
    "manufacturer name",
    "MANUFACTURER NAME",
    "Manufacturer",
    "manufacturer",
  ],
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

/**
 * Headers compare on letters and digits alone.
 *
 * Spreadsheets reach this importer typed by hand and exported by tools that
 * each punctuate differently, so "Item No.", "ITEM NO", "item_no" and "itemno"
 * all have to land on the same column. Matching the alias list literally meant
 * a single trailing space on a header silently produced an empty column and an
 * upload that reported every row as a no-op.
 */
const headerKey = (header: string): string => header.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Read one uploaded spreadsheet row into the six columns. */
export function extractMetadataSheetRow(row: Record<string, unknown>): MetadataSheetRow {
  // One pass over the row's own headers, keeping the first spelling of any
  // that normalise alike so a duplicated column cannot shadow the real one.
  const byKey = new Map<string, unknown>()
  for (const [header, value] of Object.entries(row)) {
    const key = headerKey(header)
    if (key && !byKey.has(key)) byKey.set(key, value)
  }

  const result = {} as MetadataSheetRow
  for (const field of METADATA_SHEET_FIELDS) {
    result[field] = firstNonEmpty(
      ...COLUMN_ALIASES[field].map((alias) => byKey.get(headerKey(alias))),
    )
  }
  return result
}

/**
 * Stamped on every product this sheet classifies.
 *
 * `category` and `brand` mean different things before and after a correction:
 * a warehouse product keeps its *top level* in `category`/`groupName` and a
 * copy of that same value in `brand`, while a corrected one keeps the real
 * category and the real brand there. Read it wrong and the next download shows
 * a value one level off, which that sheet then writes back for real.
 *
 * Nothing already on the document separates the two cases. `division` alone is
 * not enough — a row correcting only the category leaves it unset. Inferring
 * it from the values is worse: a catalogue with a "Samsung" category and
 * Samsung-branded products would have its brand read as a duplicate and
 * silently dropped. So the importer records what it did.
 */
export const METADATA_TAXONOMY_SOURCE = "metadata-sheet"

/**
 * Pre-fill one sheet row from a stored product.
 *
 * A classified product is read back literally. An unclassified one is still in
 * warehouse shape, so its top level feeds the division, the category comes
 * from the sub-category below it, and the manufacturer is the better guess at
 * the brand than the category copy sitting in `brand`.
 */
export function metadataSheetRowFromProduct(product: unknown): MetadataSheetRow {
  const source = isRecord(product) ? product : {}
  const raw = isRecord(source.raw) ? source.raw : {}

  const ownDivision = firstNonEmpty(source.division, raw["Division"])
  const classified = source.taxonomySource === METADATA_TAXONOMY_SOURCE || ownDivision !== ""

  const subCategory = firstNonEmpty(
    source.subCategory,
    source.prod_desc,
    raw["sub-category/PROD DESC"],
    raw["Sub-Category/PROD DESC"],
    raw["PROD DESC"],
  )

  const manufacturer = firstNonEmpty(
    source.manufacturerName,
    source.manufacturer_name,
    source.manufacturer,
    raw["Manufacturer Name"],
    raw["Manufacturer"],
  )

  return {
    itemno: firstNonEmpty(
      source.sku,
      source.itemno,
      source.itemNo,
      raw["itemno"],
      raw["Item No."],
      raw["Item No"],
      raw["ITEM NO"],
    ),
    name: firstNonEmpty(source.name, raw["Name"], raw["Item Description"]),
    division: firstNonEmpty(
      ownDivision,
      // `raw` is the untouched ERP mirror, which this module never writes, so
      // these always mean the warehouse top level. The mutable fields mean it
      // only until the sheet has claimed them for the category.
      raw["Category/Group Name"],
      raw["Group Name"],
      raw["ITEM CATEGORY"],
      classified ? "" : source.groupName,
      classified ? "" : source.category,
    ),
    category: classified
      ? firstNonEmpty(source.category, source.groupName, raw["Category"], subCategory)
      : firstNonEmpty(raw["Category"], subCategory),
    segment: firstNonEmpty(
      source.segment,
      raw["Segment"],
      source.characteristics,
      source.char_desc,
      raw["CHAR DESC"],
    ),
    brand: classified
      ? firstNonEmpty(source.brand, raw["Brand"], manufacturer)
      : firstNonEmpty(manufacturer, source.brand, raw["Brand"]),
  }
}

/**
 * The document fields one sheet row writes.
 *
 * An empty cell leaves the stored value alone rather than clearing it, so a
 * sheet listing only the columns being corrected is safe to upload. `category`
 * writes `groupName` too because parts of the storefront still read that name.
 */
export function metadataDocumentUpdates(row: MetadataSheetRow): Record<string, string> {
  const updates: Record<string, string> = {}

  if (row.name) updates.name = row.name
  if (row.division) updates.division = row.division
  if (row.category) {
    updates.category = row.category
    updates.groupName = row.category
  }
  if (row.segment) updates.segment = row.segment
  if (row.brand) updates.brand = row.brand

  // Only a taxonomy edit changes how the fields are read back; correcting a
  // product's name tells us nothing about its classification.
  const touchedTaxonomy = row.division || row.category || row.segment || row.brand
  if (touchedTaxonomy) updates.taxonomySource = METADATA_TAXONOMY_SOURCE

  return updates
}

/** True when a row carries at least one value to write. */
export function metadataRowHasUpdates(row: MetadataSheetRow): boolean {
  return METADATA_SHEET_EDITABLE_FIELDS.some((field) => row[field])
}
