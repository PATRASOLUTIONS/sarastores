import {
  withPartnerAuth, createSuccessResponse, createErrorResponse, checkPartnerPermission,
  permissionDeniedResponse, type PartnerAuthContext, type PartnerAuthRequest, OPTIONS,
} from '@/lib/partner'
import { getPartnerCatalogProduct, partnerCatalogSnapshot } from '@/lib/partner/catalogue'

export { OPTIONS }

export const GET = withPartnerAuth(async (request: PartnerAuthRequest) => {
  const context: PartnerAuthContext = { apiKey: request.apiKey, partner: request.partner, requestId: request.requestId }
  if (!checkPartnerPermission(context, 'products', 'read')) return permissionDeniedResponse(context.requestId, 'products', 'read')
  try {
    const id = decodeURIComponent(new URL(request.url).pathname.split('/').pop() || '')
    if (!id || id.length > 100) return createErrorResponse('VALIDATION_ERROR', 'Invalid product ID', context.requestId, 400)
    const product = await getPartnerCatalogProduct(id)
    if (!product) return createErrorResponse('NOT_FOUND', 'Product not found', context.requestId, 404)
    const snapshot = partnerCatalogSnapshot(product)
    const specifications = Object.fromEntries(Object.entries(product.technical_details || {})
      .filter(([key]) => !/url|image/i.test(key)))
    return createSuccessResponse({
      ...snapshot,
      images: snapshot.images.map((url, index) => ({ url, alt: `${snapshot.name || 'Product'} - Image ${index + 1}`, isPrimary: index === 0 })),
      specifications, model: product.model || '',
      highlights: Array.isArray(product.highlights) ? product.highlights.filter((value): value is string => typeof value === 'string') : [],
      deliveryInfo: {
        estimatedDays: null, freeDelivery: null, installationAvailable: null,
        message: 'Confirm delivery and installation with the store; consult the server order quote for charges.',
      },
    }, context.requestId)
  } catch (error) {
    if (error instanceof URIError) return createErrorResponse('VALIDATION_ERROR', 'Invalid product ID encoding', context.requestId, 400)
    console.error('[Partner Product Details] Error:', error)
    return createErrorResponse('INTERNAL_ERROR', 'Failed to fetch product details', context.requestId, 500)
  }
})
