import { cache } from "react"
import { getCollection, normalizeId } from "@/lib/db-service"
import { publicCatalogueFilter, getPublicCatalogueSelection } from "@/lib/public-catalogue"
import { getReviewProduct } from "@/lib/reviews"
import { isPublicProduct } from "@/lib/product-visibility"
import { productDetailResponseSchema, productListingListResponseSchema, type ProductDetailResponse } from "@/lib/product-card-response"
import { catalogCategoryListResponseSchema, catalogSubCategoryListResponseSchema } from "@/lib/catalog-list-response"
import { campaignPageResponseSchema, publicCampaignPageResponseSchema } from "@/lib/campaign-page"
import { publicSoftwareProductSchema } from "@/lib/software-list-response"
import { getCatalogMRP } from "@/lib/product-display"
import { productSpecificationResponseSchema } from "@/lib/product-specification-response"
import { buildSchemaSynchronizedRaw, normalizeProductForSchema } from "@/lib/product-schema"
import { catalogueBrand } from "@/lib/product-metadata-sheet"

// Pass public response fields, never arbitrary operational database fields.
function publicFields(record: Record<string, unknown>) {
  const fields = Object.fromEntries(Object.keys(productDetailResponseSchema.shape)
    .filter(key => record[key] !== undefined).map(key => [key, record[key]]))
  return JSON.parse(JSON.stringify({ ...fields, raw: buildSchemaSynchronizedRaw({}, normalizeProductForSchema(record)),
    brand: catalogueBrand(record), price: Number(record.price), mrp: getCatalogMRP(record), stock: record.stock == null ? undefined : Number(record.stock) || 0 }))
}

export const getPublicPageProducts = cache(async () => {
  const records = await (await getCollection("products")).find(await publicCatalogueFilter()).sort({ _id: 1 }).toArray()
  return productListingListResponseSchema.parse(records.map(record => publicFields(normalizeId(record))))
})

export const getPublicPageCategories = cache(async () => {
  const records = await (await getCollection("categories")).find({ isEnabled: { $ne: false } }).toArray()
  return catalogCategoryListResponseSchema.parse(normalizeId(records))
})

export const getPublicPageSubCategories = cache(async () =>
  catalogSubCategoryListResponseSchema.parse(await (await getCollection("sub_categories")).find({ active: { $ne: false } }).toArray()))

export const getPublicPageBrands = cache(async () => {
  const records = await (await getCollection("brands")).find({}).toArray()
  return records.map(record => Object.fromEntries(["name", "slug", "logo", "enabled", "active", "isEnabled", "landingPageEnabled"]
    .filter(key => record[key] !== undefined).map(key => [key, record[key]])))
})

export const getPublicPageSoftware = cache(async () => {
  const records = await (await getCollection("software_products")).find({ status: "active" }).sort({ createdAt: -1 }).toArray()
  return records.map(record => publicSoftwareProductSchema.parse(normalizeId(record)))
})

export const getPublicPageCampaign = cache(async (slug: string) => {
  const record = await (await getCollection("campaign_pages")).findOne({ slug: decodeURIComponent(slug), isActive: true })
  if (!record) return null
  const campaign = campaignPageResponseSchema.parse(normalizeId(record))
  if (campaign.productIds.length > 500) throw new Error("Stored campaign exceeds product limit")
  const selection = await getPublicCatalogueSelection()
  const ids = new Set(campaign.productIds.flatMap(id => selection.representativeIds.get(id) ?? []).map(String))
  const products = (await getPublicPageProducts()).filter(product => ids.has(product.id))
  return publicCampaignPageResponseSchema.parse({ success: true, campaign: { ...campaign, products } }).campaign
})

export const getPublicPageProduct = cache(async (slug: string): Promise<ProductDetailResponse | null> => {
  const record = await getReviewProduct(decodeURIComponent(slug))
  if (!isPublicProduct(record)) return null
  const specs = record.sku ? await (await getCollection("product_specifications")).findOne({ sku: record.sku }) : null
  const details = specs ? productSpecificationResponseSchema.parse(specs) : {}
  return productDetailResponseSchema.parse(publicFields({ ...record, ...details, id: record.id, name: record.name,
    price: record.price, stock: record.stock, mrp: record.mrp || details.mrp }))
})
