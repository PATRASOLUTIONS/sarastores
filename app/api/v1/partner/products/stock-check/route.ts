/**
 * Partner Stock Check API
 * 
 * POST /api/v1/partner/products/stock-check - Bulk stock and price check
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
 * POST /api/v1/partner/products/stock-check
 * Check stock and pricing for multiple products
 */
export const POST = withPartnerAuth(async (
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
    const body = await request.json();
    
    // Validate request body
    if (!body.productIds || !Array.isArray(body.productIds)) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'productIds array is required',
        context.requestId,
        400
      );
    }
    
    if (body.productIds.length === 0) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'productIds array cannot be empty',
        context.requestId,
        400
      );
    }
    
    // Limit to 50 products per request
    if (body.productIds.length > 50) {
      return createErrorResponse(
        'VALIDATION_ERROR',
        'Maximum 50 products per request',
        context.requestId,
        400
      );
    }
    
    const collection = await getCollection(PRODUCTS_COLLECTION);
    
    // Convert string IDs to ObjectIds where valid
    const objectIds: ObjectId[] = [];
    const stringIds: string[] = [];
    
    for (const id of body.productIds) {
      try {
        objectIds.push(new ObjectId(id));
      } catch (e) {
        stringIds.push(id);
      }
    }
    
    // Build query to match by _id or id field
    const query: any = { active: true };
    if (objectIds.length > 0 && stringIds.length > 0) {
      query.$or = [
        { _id: { $in: objectIds } },
        { id: { $in: stringIds } },
      ];
    } else if (objectIds.length > 0) {
      query._id = { $in: objectIds };
    } else {
      query.id = { $in: stringIds };
    }
    
    // Fetch products
    const products = await collection
      .find(query)
      .project({
        _id: 1,
        sku: 1,
        name: 1,
        price: 1,
        mrp: 1,
        stock: 1,
        updatedAt: 1,
      })
      .toArray();
    
    // Transform products
    const stockInfo = products.map(product => ({
      id: product._id.toString(),
      sku: product.sku || '',
      name: product.name || '',
      price: product.price || 0,
      mrp: product.mrp || product.price || 0,
      stock: product.stock || 0,
      inStock: (product.stock || 0) > 0,
      lastUpdated: product.updatedAt || new Date(),
    }));
    
    // Find missing products
    const foundIds = new Set(products.map(p => p._id.toString()));
    const missingIds = body.productIds.filter((id: string) => {
      try {
        return !foundIds.has(new ObjectId(id).toString());
      } catch (e) {
        return true;
      }
    });
    
    return createSuccessResponse(
      {
        products: stockInfo,
        found: stockInfo.length,
        missing: missingIds,
        checkedAt: new Date().toISOString(),
      },
      context.requestId
    );
  } catch (error) {
    console.error('[Partner Stock Check] Error:', error);
    return createErrorResponse(
      'INTERNAL_ERROR',
      'Failed to check stock',
      context.requestId,
      500
    );
  }
});
