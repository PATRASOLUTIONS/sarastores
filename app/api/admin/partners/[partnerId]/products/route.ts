/**
 * Admin Partner Products API
 * 
 * GET /api/admin/partners/[partnerId]/products - Get partner product assignments
 * POST /api/admin/partners/[partnerId]/products - Update partner product assignments
 */

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkAdminAuthorization } from '@/lib/auth';
import { getPartnerById } from '@/lib/partner/service';
import { getCollection } from '@/lib/db-service';

const PARTNER_PRODUCTS_COLLECTION = 'partner_products';

interface PartnerProduct {
  productId: string;
  customPrice?: number;
  customCommission?: number;
  enabled: boolean;
}

/**
 * GET /api/admin/partners/[partnerId]/products
 * Get product assignments for a partner
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }

  try {
    const { partnerId } = await params;

    // Verify partner exists
    const partner = await getPartnerById(partnerId);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }

    // Get partner product assignments. Match partnerId stored as a string or as an ObjectId.
    const collection = await getCollection(PARTNER_PRODUCTS_COLLECTION);
    let partnerFilter: any = { partnerId };
    try {
      partnerFilter = { $or: [{ partnerId }, { partnerId: new ObjectId(partnerId) }] };
    } catch (e) {
      partnerFilter = { partnerId };
    }

    const assignments = await collection.find(partnerFilter).toArray();

    // Normalize productId values to strings to avoid mixed-type issues
    const products = assignments.map(a => {
      const rawProductId = a.productId;
      const pid = rawProductId && typeof rawProductId === 'object' && rawProductId.toString
        ? rawProductId.toString()
        : String(rawProductId);

      return {
        productId: pid,
        customPrice: a.customPrice,
        customCommission: a.customCommission,
        enabled: a.enabled !== false,
      };
    });

    // Fetch full product details for enabled products
    const enabledProductIds = products
      .filter(p => p.enabled)
      .map(p => p.productId)
      .filter(Boolean);

    let enabledProductDetails: any[] = [];
    if (enabledProductIds.length > 0) {
      const productsCollection = await getCollection('products');
      // Try matching by ObjectId first, fallback to string
      const objectIds = enabledProductIds.map(id => {
        try { return new ObjectId(id); } catch { return null; }
      }).filter(Boolean);

      // First try to fetch by ObjectId (for ids that are valid ObjectId hex strings)
      let productDocs: any[] = []
      if (objectIds.length > 0) {
        productDocs = await productsCollection.find({ _id: { $in: objectIds } }).project({
          _id: 1, name: 1, sku: 1, price: 1, mrp: 1, images: 1, image: 1,
          category: 1, stock: 1, active: 1
        }).toArray();
      }

      // If some products are still missing (because _id is ObjectId but we only have string ids),
      // try a lookup that compares the stringified _id values using $expr + $toString.
      if (productDocs.length < enabledProductIds.length) {
        const missingIds = enabledProductIds.filter(id => !productDocs.find(d => d._id && d._id.toString() === id))
        if (missingIds.length > 0) {
          const extra = await productsCollection.find({
            $expr: { $in: [{ $toString: '$_id' }, missingIds] }
          }).project({ _id: 1, name: 1, sku: 1, price: 1, mrp: 1, images: 1, image: 1,
            category: 1, stock: 1, active: 1 }).toArray();
          // Merge extra docs (avoid duplicates)
          const existingIds = new Set(productDocs.map(d => d._id.toString()))
          for (const ex of extra) {
            if (!existingIds.has(ex._id.toString())) productDocs.push(ex)
          }
        }
      }

      enabledProductDetails = productDocs.map(p => ({
        _id: p._id.toString(),
        name: p.name || '',
        sku: p.sku || '',
        price: p.price || 0,
        mrp: p.mrp || p.price || 0,
        images: p.images || (p.image ? [p.image] : []),
        category: p.category || '',
        stock: p.stock || 0,
        active: p.active !== false,
      }));
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId,
        products,
        total: products.length,
        enabledCount: enabledProductIds.length,
        enabledProductDetails,
      },
    });
  } catch (error) {
    console.error('[Admin Partner Products] Get error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get product assignments' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/partners/[partnerId]/products
 * Update product assignments for a partner
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const authCheck = await checkAdminAuthorization();
  if (!authCheck.authorized) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: authCheck.error } },
      { status: 401 }
    );
  }

  try {
    const { partnerId } = await params;
    const body = await request.json();
    const { products } = body as { products: PartnerProduct[] };

    if (!Array.isArray(products)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Products array is required' } },
        { status: 400 }
      );
    }

    // Verify partner exists
    const partner = await getPartnerById(partnerId);
    if (!partner) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Partner not found' } },
        { status: 404 }
      );
    }

    const collection = await getCollection(PARTNER_PRODUCTS_COLLECTION);

    // Process each product assignment
    for (const product of products) {
      await collection.updateOne(
        { partnerId, productId: product.productId },
        {
          $set: {
            partnerId,
            productId: product.productId,
            customPrice: product.customPrice,
            customCommission: product.customCommission,
            enabled: product.enabled,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    // Count enabled products
    const enabledCount = await collection.countDocuments({
      partnerId,
      enabled: true
    });

    return NextResponse.json({
      success: true,
      data: {
        partnerId,
        updated: products.length,
        enabled: enabledCount,
      },
      message: `Successfully updated ${products.length} product assignments`,
    });
  } catch (error) {
    console.error('[Admin Partner Products] Update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update product assignments' } },
      { status: 500 }
    );
  }
}
