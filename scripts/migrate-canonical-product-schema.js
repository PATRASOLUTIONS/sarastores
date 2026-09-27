#!/usr/bin/env node

/*
  Canonical product schema migration.
  - Ensures top-level fields and raw keys are synchronized to canonical names.
  - Optional strict mode removes alias keys from raw after migration.

  Usage:
    node scripts/migrate-canonical-product-schema.js --dry-run
    node scripts/migrate-canonical-product-schema.js
    node scripts/migrate-canonical-product-schema.js --strict
*/

const { MongoClient } = require("mongodb")

const CANONICAL = {
  sku: "itemno",
  name: "Name",
  description: "Description",
  charDesc: "CHAR DESC",
  categoryGroupName: "Category/Group Name",
  subCategoryProdDesc: "sub-category/PROD DESC",
  manufacturerName: "Manufacturer Name",
}

const ALIASES = {
  sku: ["itemno", "Item No.", "Item No", "item no", "ItemNo", "ITEMNO", "item_no", "SKU", "sku", "Sku", "ITEM NO"],
  name: ["Name", "name", "NAME", "Product Name", "Item Description"],
  description: ["Description", "description", "DESCRIPTION", "Product Description"],
  charDesc: ["CHAR DESC", "Char Desc", "char desc", "Characteristics", "CHARDESC", "CHAR_DESC"],
  categoryGroupName: ["Category/Group Name", "Category", "category", "CATEGORY", "Group Name", "group name", "GroupName", "groupName", "ITEM CATEGORY"],
  subCategoryProdDesc: ["sub-category/PROD DESC", "Sub-Category/PROD DESC", "sub-category", "Sub-Category", "subcategory", "Subcategory", "SubCategory", "PROD DESC", "Prod Desc", "prod desc"],
  manufacturerName: ["Manufacturer Name", "manufacturer name", "MANUFACTURER NAME", "ManufacturerName", "Manufacturer", "manufacturer"],
}

const argv = new Set(process.argv.slice(2))
const isDryRun = argv.has("--dry-run")
const isStrict = argv.has("--strict")

function firstNonEmpty(values) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const normalized = String(value).trim()
    if (normalized) return normalized
  }
  return ""
}

function readAliases(source, keys) {
  if (!source || typeof source !== "object") return ""
  const values = keys.map((k) => source[k])
  return firstNonEmpty(values)
}

function resolveCanonical(product) {
  const raw = product.raw || {}

  return {
    itemno: firstNonEmpty([
      product.sku,
      product.itemNo,
      product.itemno,
      readAliases(raw, ALIASES.sku),
    ]),
    name: firstNonEmpty([
      product.name,
      readAliases(raw, ALIASES.name),
    ]),
    description: firstNonEmpty([
      product.description,
      readAliases(raw, ALIASES.description),
    ]),
    charDesc: firstNonEmpty([
      product.char_desc,
      product.characteristics,
      readAliases(raw, ALIASES.charDesc),
    ]),
    categoryGroupName: firstNonEmpty([
      product.groupName,
      product.category,
      product.itemCategory,
      readAliases(raw, ALIASES.categoryGroupName),
    ]),
    subCategoryProdDesc: firstNonEmpty([
      product.subCategory,
      product.prod_desc,
      readAliases(raw, ALIASES.subCategoryProdDesc),
    ]),
    manufacturerName: firstNonEmpty([
      product.manufacturerName,
      product.manufacturer_name,
      product.manufacturer,
      readAliases(raw, ALIASES.manufacturerName),
    ]),
  }
}

function pruneRawAliases(raw) {
  for (const [field, aliases] of Object.entries(ALIASES)) {
    const canonicalKey = CANONICAL[field]
    for (const alias of aliases) {
      if (alias !== canonicalKey && Object.prototype.hasOwnProperty.call(raw, alias)) {
        delete raw[alias]
      }
    }
  }
}

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is required")
  }

  const dbName = process.env.MONGODB_DB || "e-commerce-bytewise"
  const client = new MongoClient(uri)

  let scanned = 0
  let changed = 0

  try {
    await client.connect()
    const db = client.db(dbName)
    const products = db.collection("products")

    const cursor = products.find({})

    while (await cursor.hasNext()) {
      const product = await cursor.next()
      if (!product) continue
      scanned += 1

      const canonical = resolveCanonical(product)
      const raw = { ...(product.raw || {}) }

      if (canonical.itemno) raw[CANONICAL.sku] = canonical.itemno
      if (canonical.name) raw[CANONICAL.name] = canonical.name
      if (canonical.description) raw[CANONICAL.description] = canonical.description
      if (canonical.charDesc) raw[CANONICAL.charDesc] = canonical.charDesc
      if (canonical.categoryGroupName) raw[CANONICAL.categoryGroupName] = canonical.categoryGroupName
      if (canonical.subCategoryProdDesc) raw[CANONICAL.subCategoryProdDesc] = canonical.subCategoryProdDesc
      if (canonical.manufacturerName) raw[CANONICAL.manufacturerName] = canonical.manufacturerName

      if (isStrict) {
        pruneRawAliases(raw)
      }

      const updateSet = {
        raw,
        updatedAt: new Date(),
      }

      if (canonical.itemno) {
        updateSet.sku = canonical.itemno
        updateSet.itemno = canonical.itemno
      }
      if (canonical.name) updateSet.name = canonical.name
      if (canonical.description) updateSet.description = canonical.description
      if (canonical.charDesc) updateSet.char_desc = canonical.charDesc
      if (canonical.categoryGroupName) updateSet.groupName = canonical.categoryGroupName
      if (canonical.subCategoryProdDesc) {
        updateSet.subCategory = canonical.subCategoryProdDesc
        updateSet.prod_desc = canonical.subCategoryProdDesc
      }
      if (canonical.manufacturerName) {
        updateSet.manufacturerName = canonical.manufacturerName
        updateSet.manufacturer_name = canonical.manufacturerName
      }

      const updateDoc = { $set: updateSet }

      changed += 1
      if (!isDryRun) {
        await products.updateOne({ _id: product._id }, updateDoc)
      }
    }

    console.log(`Scanned: ${scanned}`)
    console.log(`${isDryRun ? "Would update" : "Updated"}: ${changed}`)
    console.log(`Mode: ${isStrict ? "strict" : "compat"}`)
    if (isDryRun) {
      console.log("Dry-run only. No changes were written.")
    }
  } finally {
    await client.close()
  }
}

run().catch((error) => {
  console.error("Migration failed:", error)
  process.exit(1)
})
