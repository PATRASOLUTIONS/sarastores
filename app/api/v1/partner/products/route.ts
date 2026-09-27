/**
 * Partner Products API
 * 
 * GET /api/v1/partner/products - List products
 * POST /api/v1/partner/products/stock-check - Check stock for multiple products
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  withPartnerAuth, 
  createSuccessResponse, 
  createPaginatedResponse,
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
 * GET /api/v1/partner/products
 * List products with pagination and filters
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
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const category = searchParams.get('category');
    const subCategory = searchParams.get('subCategory');
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const inStock = searchParams.get('inStock');
    const brand = searchParams.get('brand');
    
    // Build filter
    const filter: any = { active: true };
    
    if (category) {
      filter.category = category;
    }
    
    if (subCategory) {
      filter.subCategory = subCategory;
    }
    
    if (brand) {
      filter.brand = { $regex: brand, $options: 'i' };
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    }
    
    const collection = await getCollection(PRODUCTS_COLLECTION);
    const skip = (page - 1) * limit;
    
    // Execute query
    const [products, total] = await Promise.all([
      collection
        .find(filter)
        .project({
          _id: 1,
          name: 1,
          sku: 1,
          description: 1,
          category: 1,
          subCategory: 1,
          price: 1,
          mrp: 1,
          stock: 1,
          image: 1,
          specification_images: 1,
          brand: 1,
          warranty: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);
    
    // Transform products for partner API
    const transformedProducts = products.map(transformProduct);
    
    return createPaginatedResponse(
      transformedProducts,
      page,
      limit,
      total,
      context.requestId,
      { products: transformedProducts }
    );
  } catch (error) {
    console.error('[Partner Products] Error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to fetch products',
      context.requestId,
      500
    );
  }
});

/**
 * Transform product for partner API response
 */
function transformProduct(product: any) {
  const price = product.price || 0;
  const mrp = product.mrp || product.originalPrice || price;
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  
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
    brand: product.brand || '',
    warranty: product.warranty || '',
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

/**
 * Get product images array
 */
function getProductImages(product: any): string[] {
  const images: string[] = [];
  
  if (product.image) {
    images.push(product.image);
  }
  
  if (product.specification_images) {
    if (Array.isArray(product.specification_images)) {
      images.push(...product.specification_images);
    } else if (typeof product.specification_images === 'string') {
      images.push(product.specification_images);
    }
  }
  
  return images.length > 0 ? images : ['/placeholder.svg'];
}
