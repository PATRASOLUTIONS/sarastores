import {
  withPartnerAuth, createSuccessResponse, createErrorResponse, checkPartnerPermission,
  permissionDeniedResponse, type PartnerAuthContext, type PartnerAuthRequest, OPTIONS,
} from '@/lib/partner'
import { getCollection } from '@/lib/db-service'
import { PartnerStockCheckSchema, partnerProductIdFilter, partnerCatalogSnapshot, type PartnerCatalogDocument } from '@/lib/partner/catalogue'
import { ObjectId } from 'mongodb'

export { OPTIONS }

export const POST = withPartnerAuth(async (request: PartnerAuthRequest) => {
  const context: PartnerAuthContext = { apiKey: request.apiKey, partner: request.partner, requestId: request.requestId }
  if (!checkPartnerPermission(context, 'products', 'read')) return permissionDeniedResponse(context.requestId, 'products', 'read')
  try {
    let body: unknown
    try { body = await request.json() } catch {
      return createErrorResponse('VALIDATION_ERROR', 'Invalid JSON body', context.requestId, 400)
    }
    const parsed = PartnerStockCheckSchema.safeParse(body)
    if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', 'Provide 1 to 50 unique product IDs', context.requestId, 400)
    const collection = await getCollection<PartnerCatalogDocument>('products')
    const products = await collection.find(partnerProductIdFilter(parsed.data.productIds)).project<PartnerCatalogDocument>({
      _id: 1, id: 1, sku: 1, name: 1, price: 1, mrp: 1, originalPrice: 1, stock: 1, updatedAt: 1,
    }).toArray()
    const foundIds = new Set(products.flatMap(product => [product._id.toString(), ...(product.id ? [product.id] : [])]))
    return createSuccessResponse({
      products: products.map(product => {
        const snapshot = partnerCatalogSnapshot(product)
        return {
          id: snapshot.id, sku: snapshot.sku, name: snapshot.name, price: snapshot.price,
          mrp: snapshot.mrp, stock: snapshot.stock, inStock: snapshot.inStock, lastUpdated: product.updatedAt ?? null,
        }
      }),
      found: products.length, missing: parsed.data.productIds.filter(id =>
        !foundIds.has(id) && !(ObjectId.isValid(id) && foundIds.has(new ObjectId(id).toString()))),
      checkedAt: new Date().toISOString(),
    }, context.requestId)
  } catch (error) {
    console.error('[Partner Stock Check] Error:', error)
    return createErrorResponse('INTERNAL_ERROR', 'Failed to check stock', context.requestId, 500)
  }
})
