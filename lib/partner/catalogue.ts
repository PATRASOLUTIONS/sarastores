import { ObjectId, type Filter } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import { productImageUrls } from '@/lib/product-images'
import { z } from 'zod'

export interface PartnerCatalogDocument {
  _id: ObjectId | string
  id?: string
  name?: string
  sku?: string
  description?: string
  category?: string
  subCategory?: string
  brand?: string
  model?: string
  warranty?: string
  price?: number
  mrp?: number
  originalPrice?: number
  stock?: number
  active?: boolean
  image?: unknown
  images?: unknown
  specification_images?: unknown
  technical_details?: Record<string, unknown> | null
  highlights?: unknown
  createdAt?: Date | string
  updatedAt?: Date | string
}

const priceBound = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/).transform(Number)
  .pipe(z.number().finite().min(0).max(10000000))
export const PartnerCatalogQuerySchema = z.object({
  page: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(100000)).default('1'),
  limit: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(100)).default('20'),
  category: z.string().min(1).max(200).optional(),
  subCategory: z.string().min(1).max(200).optional(),
  brand: z.string().min(1).max(200).optional(),
  search: z.string().min(1).max(200).optional(),
  minPrice: priceBound.optional(), maxPrice: priceBound.optional(),
  inStock: z.enum(['true', 'false']).optional(),
}).refine(value => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice)
export const PartnerStockCheckSchema = z.object({
  productIds: z.array(z.string().trim().min(1).max(100)).min(1).max(50)
    .refine(ids => new Set(ids).size === ids.length, 'Duplicate product IDs are not allowed'),
}).strict()

export function partnerCatalogFilter(input: z.infer<typeof PartnerCatalogQuerySchema>): Filter<PartnerCatalogDocument> {
  const literal = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const search = input.search
  return {
    active: true,
    ...(input.category ? { category: input.category } : {}),
    ...(input.subCategory ? { subCategory: input.subCategory } : {}),
    ...(input.brand ? { brand: { $regex: literal(input.brand), $options: 'i' } } : {}),
    ...(search ? { $or: ['name', 'sku', 'description'].map(key => ({
      [key]: { $regex: literal(search), $options: 'i' },
    })) } : {}),
    ...(input.minPrice !== undefined || input.maxPrice !== undefined ? { price: {
      ...(input.minPrice !== undefined ? { $gte: input.minPrice } : {}),
      ...(input.maxPrice !== undefined ? { $lte: input.maxPrice } : {}),
    } } : {}),
    ...(input.inStock === 'true' ? { stock: { $gt: 0 } } : {}),
  }
}

export function partnerProductIdFilter(ids: string[]): Filter<PartnerCatalogDocument> {
  return {
    active: true,
    $or: [
      { _id: { $in: ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } },
      { _id: { $in: ids } }, { id: { $in: ids } },
    ],
  }
}

export async function getPartnerCatalogProduct(id: string) {
  const collection = await getCollection<PartnerCatalogDocument>('products')
  return (ObjectId.isValid(id) ? await collection.findOne({ _id: new ObjectId(id), active: true }) : null)
    ?? await collection.findOne({ _id: id, active: true })
    ?? await collection.findOne({ id, active: true })
}

export function partnerCatalogSnapshot(product: PartnerCatalogDocument) {
  if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price < 0 ||
      (product.stock !== undefined && (!Number.isSafeInteger(product.stock) || product.stock < 0))) {
    throw new Error('Stored partner catalogue price or inventory is invalid')
  }
  const price = product.price
  const mrp = product.mrp ?? product.originalPrice ?? price
  if (!Number.isFinite(mrp) || mrp < 0) throw new Error('Stored partner catalogue MRP is invalid')
  const sources = [product.image, product.images, product.specification_images,
    ...['URL', 'Url', 'url', 'From Manufacturer URL', 'Manufacturer URL'].map(key => product.technical_details?.[key])]
  const images = productImageUrls(sources)
  return {
    id: product._id.toString(), sku: product.sku || '', name: product.name || '',
    description: product.description || '', category: product.category || '', subCategory: product.subCategory || '',
    price, mrp, discount: mrp > price ? Math.round((mrp - price) / mrp * 100) : 0,
    stock: product.stock ?? 0, inStock: (product.stock ?? 0) > 0,
    images: images.length ? images : ['/placeholder.svg'],
    brand: product.brand || '', warranty: product.warranty || '', createdAt: product.createdAt, updatedAt: product.updatedAt,
  }
}
