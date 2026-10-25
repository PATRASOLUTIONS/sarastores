import { ObjectId } from "mongodb"
import { getCollection, normalizeId } from "@/lib/db-service"
import { connectToDatabase } from "@/lib/mongodb"
import { buildSchemaSynchronizedRaw, extractCanonicalProductMetadata } from "@/lib/product-schema"
import { buildSpecificationDocument, SPECIFICATIONS_COLLECTION } from "@/lib/product-specification-schema"
import { generateProductSlug } from "@/utils/slug"
import type { ScraperImportRow } from "./bulk-import"
import { scraperItemNumberKey } from "./bulk-import"
import { existingScraperItemNumbers } from "./item-numbers"
import { ScraperError, type ScrapedProduct } from "./types"

export async function publishScrapedProduct(row: ScraperImportRow, scraped: ScrapedProduct, activate = true) {
  row = { ...row, itemno: scraperItemNumberKey(row.itemno) }
  const skipped = { added: false as const, itemno: row.itemno, message: "Already exists — skipped" }
  if ((await existingScraperItemNumbers([row.itemno])).has(row.itemno)) return skipped
  const products = await getCollection("products")
  const specs = await getCollection(SPECIFICATIONS_COLLECTION)
  await specs.createIndex({ sku: 1 }, { unique: true, name: "sku_unique" })
  const { client } = await connectToDatabase()
  const session = client.startSession()
  try {
    return await session.withTransaction(async () => {
      if ((await existingScraperItemNumbers([row.itemno], session)).has(row.itemno)) return skipped
      const specification = await specs.findOne({ sku: row.itemno }, { session })
      if (specification?.locked) throw new ScraperError("Specification is locked; unlock it before importing", 409)
      const id = new ObjectId()
      const price = scraped.sap.price ?? 0
      const mrp = scraped.mrp ?? price
      if (!Number.isFinite(price) || !Number.isFinite(mrp) || price < 0 || mrp < price) {
        throw new ScraperError("Price exceeds MRP or stored pricing is invalid; correct pricing before importing", 409)
      }
      // Excel only needs the join key and source URL. Legacy sheets may still
      // override these values, otherwise the scrape supplies temporary
      // metadata until the Products metadata update is applied.
      const name = row.name || scraped.sap.name || row.itemno
      const category = row.category || scraped.sap.category || ""
      const subCategory = row.subCategory || scraped.sap.subCategory || ""
      const brand = row.brand || scraped.sap.brand || ""
      const charDesc = row.charDesc || scraped.sap.charDesc || ""
      const description = scraped.description || name
      const canonical = extractCanonicalProductMetadata({
        itemno: row.itemno, Name: name, Description: description,
        Category: category, SubCategory: subCategory,
        "CHAR DESC": charDesc, "Manufacturer Name": brand,
      })
      const fields = {
        sku: row.itemno, itemno: row.itemno, name,
        category, groupName: category, group_name: category,
        subCategory, prod_desc: subCategory,
        brand, manufacturerName: brand, manufacturer_name: brand,
        char_desc: charDesc, description,
        raw: { ...buildSchemaSynchronizedRaw({}, canonical), "CHAR DESC": charDesc },
        slug: `${generateProductSlug(name)}-${id.toString()}`,
        ...(scraped.images.length ? { images: scraped.images.slice(0, 8), image: scraped.images[0] } : {}),
        specifications: scraped.technicalDetails,
        features: scraped.features,
        price, mrp,
        stock: 0,
        active: activate, status: activate ? "active" : "draft",
        source: scraped.source, sourceUrl: row.url,
        updatedAt: new Date(),
      }
      const spec = buildSpecificationDocument({
        sku: row.itemno, product_id: id.toString(), name,
        category, subCategory,
        group_name: category, prod_desc: subCategory,
        char_desc: charDesc, manufacturer_name: brand, mrp,
        overview: description, technical_details: scraped.technicalDetails,
        from_manufacturer: scraped.manufacturerInfo,
        gallery_images: scraped.images, specification_images: scraped.manufacturerImages,
        included_components: scraped.whatsIncluded, features: scraped.features,
        reviews: scraped.reviews, isSynced: activate,
      })
      if (!spec) throw new Error("Could not build product specifications")
      await products.insertOne({ _id: id, ...fields, createdAt: new Date(), featured: false }, { session })
      const savedSpec = await specs.updateOne(
        { sku: row.itemno, locked: { $ne: true } }, { $set: spec }, { upsert: true, session },
      )
      if (!savedSpec.acknowledged || (!savedSpec.matchedCount && !savedSpec.upsertedId)) {
        throw new Error("Could not save product specifications")
      }
      return { added: true as const, itemno: row.itemno, product: normalizeId({ _id: id, slug: fields.slug, name: fields.name }) }
    })
  } finally {
    await session.endSession()
  }
}
