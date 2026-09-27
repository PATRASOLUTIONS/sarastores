/**
 * Partner Product Specifications API
 * 
 * GET /api/v1/partner/products/[productId]/specifications - Get detailed product specifications
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
const SPECS_COLLECTION = 'product_specifications';

/**
 * GET /api/v1/partner/products/[productId]/specifications
 * Get rich product specification information
 */
export const GET = withPartnerAuth(async (
    request: PartnerAuthRequest,
    context: { params: Promise<{ productId: string }> }
) => {
    // Build auth context from request
    const authContext: PartnerAuthContext = {
        apiKey: request.apiKey,
        partner: request.partner,
        requestId: request.requestId,
    };

    // Check permission
    if (!checkPartnerPermission(authContext, 'products', 'read')) {
        return permissionDeniedResponse(authContext.requestId, 'products', 'read');
    }

    try {
        const { productId } = await context.params;

        if (!productId) {
            return createErrorResponse(
                'VALIDATION_ERROR',
                'Product ID is required',
                authContext.requestId,
                400
            );
        }

        const productsCollection = await getCollection(PRODUCTS_COLLECTION);
        const specsCollection = await getCollection(SPECS_COLLECTION);

        // 1. Find the product to get its SKU
        let product = null;
        try {
            product = await productsCollection.findOne({ _id: new ObjectId(productId), active: true });
        } catch (e) {
            product = await productsCollection.findOne({ id: productId, active: true });
        }

        if (!product) {
            return createErrorResponse(
                'NOT_FOUND',
                'Product not found',
                authContext.requestId,
                404
            );
        }

        if (!product.sku) {
            return createErrorResponse(
                'NOT_FOUND',
                'No SKU associated with this product',
                authContext.requestId,
                404
            );
        }

        // 2. Find specifications by SKU
        const spec = await specsCollection.findOne({ sku: product.sku });

        if (!spec) {
            return createErrorResponse(
                'NOT_FOUND',
                'Specifications not found for this product',
                authContext.requestId,
                404
            );
        }

        // 3. Transform specifications for partner API
        const specifications = {
            productId: productId,
            sku: spec.sku,
            name: spec.name || product.name,
            mrp: spec.mrp || product.mrp || product.price,
            technical_details: spec.technical_details || null,
            from_manufacturer: spec.from_manufacturer || null,
            specification_images: spec.specification_images || [],
            overview: spec.overview || spec.description || product.description || null,
            included_components: spec.included_components || null,
            features: spec.features || null,
            reviews: spec.reviews || null,
            updatedAt: spec.updatedAt || spec.createdAt || null,
        };

        return createSuccessResponse(specifications, authContext.requestId);
    } catch (error) {
        console.error('[Partner Product Specifications] Error:', error);
        return createErrorResponse(
            'INTERNAL_ERROR',
            'Failed to fetch product specifications',
            authContext.requestId,
            500
        );
    }
});
