/**
 * Partner Orders API
 * POST /api/v1/partner/orders - Create new order
 * GET /api/v1/partner/orders - List orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest } from '@/lib/partner/auth';
import { createPartnerOrder, listPartnerOrders, CreateOrderInput } from '@/lib/partner/orders';
import { PartnerOrderStatus } from '@/lib/partner/types';

/**
 * POST /api/v1/partner/orders - Create a new order
 */
async function handlePost(req: PartnerAuthRequest) {
  try {
    const body = await req.json();

    // 1. Flexible Field Mapping (Aliases)
    const items = body.items;
    const customer = body.customer || body.customerDetails;
    const partnerOrderId = body.partnerOrderId || body.externalOrderId;
    const paymentDetails = body.paymentDetails || {};

    // Infer paymentMethod if missing
    let paymentMethod = body.paymentMethod?.toLowerCase();
    if (!paymentMethod && paymentDetails.paymentMethod) {
      paymentMethod = paymentDetails.paymentMethod.toLowerCase();
    }

    // Map human-readable methods to internal types
    if (paymentMethod === 'razorpay' || paymentMethod === 'stripe') {
      paymentMethod = 'prepaid';
    } else if (paymentMethod === 'cash' || paymentMethod === 'cod') {
      paymentMethod = 'cod';
    }

    // 2. Validate Items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Items array is required' },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!item.productId || typeof item.quantity !== 'number' || item.quantity < 1) {
        return NextResponse.json(
          { success: false, error: 'Each item must have productId and quantity >= 1' },
          { status: 400 }
        );
      }
    }

    // 3. Validate and Parse Customer Info
    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Customer information is required (as "customer" or "customerDetails")' },
        { status: 400 }
      );
    }

    const { name, email, phone, address } = customer;
    if (!name || !email || !phone || !address) {
      return NextResponse.json(
        { success: false, error: 'Customer name, email, phone, and address are required' },
        { status: 400 }
      );
    }

    // 4. Flexible Address Handling
    let parsedAddress;
    if (typeof address === 'string') {
      // Split address or use full string for line1
      parsedAddress = {
        line1: address,
        city: 'Unknown', // Default if missing
        state: 'Unknown',
        pincode: '000000',
        country: 'India',
      };

      // Try to extract some info if it looks like a comma separated list
      const parts = address.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        parsedAddress.pincode = parts[parts.length - 1].match(/\d{6}/)?.[0] || '000000';
        parsedAddress.state = parts[parts.length - 2];
        parsedAddress.city = parts[parts.length - 3];
      }
    } else {
      // It's an object, validate required fields
      if (!address.line1 || !address.city || !address.state || !address.pincode) {
        return NextResponse.json(
          {
            success: false,
            error: 'Address object must include line1, city, state, and pincode',
          },
          { status: 400 }
        );
      }
      parsedAddress = {
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        state: address.state,
        pincode: address.pincode || address.postalCode,
        country: address.country || 'India',
      };
    }

    // 5. Final Payment Method Validation
    if (!paymentMethod || !['prepaid', 'cod'].includes(paymentMethod)) {
      return NextResponse.json(
        { success: false, error: 'paymentMethod must be "prepaid" or "cod" (or inferrable from paymentDetails)' },
        { status: 400 }
      );
    }

    // Validate Razorpay payment details for prepaid orders
    if (paymentMethod === 'prepaid') {
      if (!paymentDetails.razorpayOrderId || !paymentDetails.transactionId) {
        return NextResponse.json(
          { success: false, error: 'razorpayOrderId and transactionId are required for prepaid orders' },
          { status: 400 }
        );
      }
    }

    // 6. Build Order Input
    const orderData: CreateOrderInput = {
      items: items.map((item: any) => ({
        productId: item.productId,
        quantity: Math.floor(item.quantity),
      })),
      customer: {
        name,
        email,
        phone,
        address: parsedAddress,
      },
      paymentMethod: paymentMethod as 'prepaid' | 'cod',
      partnerOrderId: partnerOrderId,
      notes: body.notes,
      paymentDetails: {
        razorpayOrderId: paymentDetails.razorpayOrderId,
        transactionId: paymentDetails.transactionId,
        method: paymentDetails.method || paymentDetails.paymentMethod || 'razorpay',
        amount: paymentDetails.amount || body.amount || undefined,
      },
    };

    // Test mode guard: if partner's default environment is 'test', do not persist to orders collection
    const isTestMode = (req.partner as any)?.razorpayIntegration?.defaultEnvironment === 'test'
    if (isTestMode) {
      const mockOrderId = `TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
      return NextResponse.json(
        {
          success: true,
          testMode: true,
          message: 'Order simulated in test mode – not saved to the database.',
          data: {
            order: {
              id: mockOrderId,
              orderId: mockOrderId,
              status: 'pending',
              partnerOrderId: orderData.partnerOrderId,
              items: orderData.items,
              customer: orderData.customer,
              paymentMethod: orderData.paymentMethod,
              paymentDetails: orderData.paymentDetails,
              notes: orderData.notes,
              createdAt: new Date().toISOString(),
              _testMode: true,
            },
          },
        },
        { status: 201 }
      )
    }

    const result = await createPartnerOrder(req.partner, orderData);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          order: result.order,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Partner Orders API] Create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create order' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/partner/orders - List partner orders
 */
async function handleGet(req: PartnerAuthRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get('status') as PartnerOrderStatus | null;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Validate status if provided
    const validStatuses: PartnerOrderStatus[] = [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
    ];

    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Valid values: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await listPartnerOrders(req.partner.id, {
      status: status || undefined,
      page: Math.max(1, page),
      limit: Math.min(Math.max(1, limit), 100),
    });

    return NextResponse.json({
      success: true,
      data: {
        orders: result.orders,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      },
    });
  } catch (error) {
    console.error('[Partner Orders API] List error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// Export wrapped handlers
export const POST = withPartnerAuth(handlePost as any, ['orders:write']);
export const GET = withPartnerAuth(handleGet as any, ['orders:read']);

// Handle CORS preflight requests
export { OPTIONS } from '@/lib/partner/auth';
