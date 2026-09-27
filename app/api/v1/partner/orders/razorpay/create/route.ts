/**
 * Partner Razorpay Create Order API
 * POST /api/v1/partner/orders/razorpay/create - Create Razorpay order for payment
 */

import { NextResponse } from 'next/server';
import { withPartnerAuth, PartnerAuthRequest, checkPartnerPermission, getCorsHeaders } from '@/lib/partner/auth';
import { getRazorpayClient, getRazorpayKeyId } from '@/lib/razorpay';
import { decrypt } from '@/lib/encryption';
import { connectDB } from '@/lib/db';

/**
 * POST /api/v1/partner/orders/razorpay/create
 * Creates a Razorpay order for payment processing
 */
async function handlePost(request: PartnerAuthRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  try {
    // Build context from request properties
    const context = {
      apiKey: request.apiKey,
      partner: request.partner,
      requestId: request.requestId,
    };

    // Check permission
    if (!checkPartnerPermission(context, 'orders', 'create')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to create orders',
          },
        },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Amount must be a positive number',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!body.orderId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'orderId is required to link payment to order',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const currency = body.currency || 'INR';
    const receipt = body.receipt || `partner_${context.partner.id}_${Date.now()}`;

    // Create Razorpay order
    const razorpayOptions: any = {
      amount: Math.round(body.amount * 100), // Convert to paise
      currency,
      receipt,
      payment_capture: 1, // Auto-capture payment
      notes: {
        partnerId: context.partner.id,
        partnerName: context.partner.name,
        orderId: body.orderId,
        ...(body.notes || {}),
      },
    };

    // Determine razorpay client: prefer partner credentials if configured
    let rpClient: any = null
    let keyIdToReturn = process.env.RAZORPAY_KEY_ID
    try {
      const env = (context.partner as any)?.razorpayIntegration?.defaultEnvironment || 'test'
      const creds = (context.partner as any)?.razorpayIntegration?.credentials?.[env]
      if (creds && creds.keyId && creds.keySecretEnc && creds.keySecretIv && creds.keySecretTag) {
        const secret = decrypt(creds.keySecretEnc, creds.keySecretIv, creds.keySecretTag)
        if (secret) {
          rpClient = getRazorpayClient({ keyId: creds.keyId, keySecret: secret })
          keyIdToReturn = creds.keyId
        }
      }
    } catch (e) {
      rpClient = null
    }

    const client = rpClient || getRazorpayClient()
    const razorpayOrder = await client.orders.create(razorpayOptions);

    // Store the payment initiation in database
    const db = await connectDB();
    await db.collection('partner_payments').insertOne({
      partnerId: context.partner.id,
      orderId: body.orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: body.amount,
      currency,
      status: 'created',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log(`[Partner API] Razorpay order created: ${razorpayOrder.id} for partner ${context.partner.id}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          razorpayOrderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          amountInRupees: Number(razorpayOrder.amount) / 100,
          currency: razorpayOrder.currency,
          receipt: razorpayOrder.receipt,
          status: razorpayOrder.status,
          keyId: keyIdToReturn, // Partner needs this for frontend
          notes: razorpayOrder.notes,
        },
        requestId: context.requestId,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[Partner API] Razorpay create order error:', error);

    // Handle Razorpay specific errors
    if (error.error && error.error.description) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RAZORPAY_ERROR',
            message: error.error.description,
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create Razorpay order',
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

export const POST = withPartnerAuth(handlePost);

// Handle CORS preflight
export async function OPTIONS(request: Request) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
