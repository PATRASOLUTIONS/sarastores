import {
  withPartnerAuth, createPaginatedResponse, createErrorResponse, checkPartnerPermission,
  permissionDeniedResponse, type PartnerAuthContext, type PartnerAuthRequest, OPTIONS,
} from '@/lib/partner'
import { getCollection } from '@/lib/db-service'
import { PartnerCatalogQuerySchema, partnerCatalogFilter, partnerCatalogSnapshot, type PartnerCatalogDocument } from '@/lib/partner/catalogue'

export { OPTIONS }

export const GET = withPartnerAuth(async (request: PartnerAuthRequest) => {
  const context: PartnerAuthContext = { apiKey: request.apiKey, partner: request.partner, requestId: request.requestId }
  if (!checkPartnerPermission(context, 'products', 'read')) return permissionDeniedResponse(context.requestId, 'products', 'read')
  try {
    const parsed = PartnerCatalogQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) return createErrorResponse('VALIDATION_ERROR', 'Invalid product filters', context.requestId, 400)
    const { page, limit } = parsed.data
    const filter = partnerCatalogFilter(parsed.data)
    const collection = await getCollection<PartnerCatalogDocument>('products')
    const [products, total] = await Promise.all([
      collection.find(filter).project<PartnerCatalogDocument>({
        _id: 1, name: 1, sku: 1, description: 1, category: 1, subCategory: 1, price: 1,
        mrp: 1, originalPrice: 1, stock: 1, image: 1, images: 1, specification_images: 1,
        brand: 1, warranty: 1, createdAt: 1, updatedAt: 1,
      }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray(),
      collection.countDocuments(filter),
    ])
    const data = products.map(partnerCatalogSnapshot)
    return createPaginatedResponse(data, page, limit, total, context.requestId, { products: data })
  } catch (error) {
    console.error('[Partner Products] Error:', error)
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch products', context.requestId, 500)
  }
})
