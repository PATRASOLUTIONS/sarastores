/**
 * Partner Product Details API
 * 
 * GET /api/v1/partner/products/[productId] - Get product details
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { 
  withPartnerAuth, 
  createSuccessResponse, 
  createErrorResponse,
  checkPartnerPermission,
  permissionDeniedResponse,
  PartnerAuthContext,
  PartnerAuthRequest,
  OPTIONS 
} from '@/lib/partner';
import { getCollection } from '@/lib/db-service';

// Export OPTIONS handler for CORS preflight
export { OPTIONS };

const PRODUCTS_COLLECTION = 'products';

/**
 * GET /api/v1/partner/products/[productId]
 * Get detailed product information
 */
export const GET = withPartnerAuth(async (
  request: PartnerAuthRequest
) => {
  // Build context from request
  const context: PartnerAuthContext = {
    apiKey: request.apiKey,
    partner: request.partner,
    requestId: request.requestId,
  };
  
  // Check permission
  if (!checkPartnerPermission(context, 'products', 'read')) {
    return permissionDeniedResponse(context.requestId, 'products', 'read');
  }
  
  try {
    // Extract productId from URL
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];
    
    if (!productId) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Product ID is required',
        context.requestId,
        400
      );
    }
    
    const collection = await getCollection(PRODUCTS_COLLECTION);
    
    // Try to find by ObjectId first, then by string id
    let product = null;
    try {
      product = await collection.findOne({ _id: new ObjectId(productId), active: true });
    } catch (e) {
      product = await collection.findOne({ id: productId, active: true });
    }
    
    if (!product) {
      return createErrorResponse(
        'NOT_FOUND',
        'Product not found',
        context.requestId,
        404
      );
    }
    
    // Transform product for partner API
    const transformedProduct = transformProductDetails(product);
    
    return createSuccessResponse(transformedProduct, context.requestId);
  } catch (error) {
    console.error('[Partner Product Details] Error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch product details',
      context.requestId,
      500
    );
  }
});

/**
 * Transform product for detailed partner API response
 */
function transformProductDetails(product: any) {
  const price = product.price || 0;
  const mrp = product.mrp || product.originalPrice || price;
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  
  // Extract specifications from technical_details if available
  const specifications: Record<string, any> = {};
  if (product.technical_details) {
    for (const [key, value] of Object.entries(product.technical_details)) {
      // Skip URL fields
      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('image')) {
        continue;
      }
      specifications[key] = value;
    }
  }
  
  // Get highlights from description or technical details
  const highlights: string[] = [];
  if (product.highlights) {
    if (Array.isArray(product.highlights)) {
      highlights.push(...product.highlights);
    }
  }
  
  return {
    id: product._id.toString(),
    sku: product.sku || '',
    name: product.name || '',
    description: product.description || '',
    category: product.category || '',
    subCategory: product.subCategory || '',
    price,
    mrp,
    discount,
    stock: product.stock || 0,
    inStock: (product.stock || 0) > 0,
    images: getProductImages(product),
    specifications,
    brand: product.brand || '',
    model: product.model || '',
    warranty: product.warranty || '',
    highlights,
    deliveryInfo: {
      estimatedDays: 3,
      freeDelivery: price >= 499,
      installationAvailable: ['televisions', 'air-conditioners', 'washing-machines'].includes(product.category?.toLowerCase()),
    },
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/**
 * Get product images array
 */
function getProductImages(product: any): Array<{ url: string; alt: string; isPrimary: boolean }> {
  const images: Array<{ url: string; alt: string; isPrimary: boolean }> = [];
  
  if (product.image) {
    images.push({
      url: product.image,
      alt: product.name || 'Product image',
      isPrimary: true,
    });
  }
  
  if (product.specification_images) {
    const specImages = Array.isArray(product.specification_images) 
      ? product.specification_images 
      : [product.specification_images];
    
    specImages.forEach((img: string, index: number) => {
      if (img && typeof img === 'string') {
        images.push({
          url: img,
          alt: `${product.name || 'Product'} - Image ${index + 2}`,
          isPrimary: images.length === 0,
        });
      }
    });
  }
  
  // Extract images from technical_details URL fields
  if (product.technical_details) {
    const urlKeys = ['URL', 'Url', 'url', 'From Manufacturer URL', 'Manufacturer URL'];
    for (const key of urlKeys) {
      const value = product.technical_details[key];
      if (value) {
        const urls = Array.isArray(value) ? value : [value];
        urls.forEach((url: string, index: number) => {
          if (typeof url === 'string' && url.startsWith('http')) {
            images.push({
              url,
              alt: `${product.name || 'Product'} - Spec image ${index + 1}`,
              isPrimary: images.length === 0,
            });
          }
        });
      }
    }
  }
  
  if (images.length === 0) {
    images.push({
      url: '/placeholder.svg',
      alt: 'Product placeholder',
      isPrimary: true,
    });
  }
  
  return images;
}
