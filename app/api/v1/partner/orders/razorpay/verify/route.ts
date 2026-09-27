/**
 * Partner Razorpay Verify Payment API
 * POST /api/v1/partner/orders/razorpay/verify - Verify Razorpay payment signature
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { withPartnerAuth, PartnerAuthRequest, checkPartnerPermission, getCorsHeaders } from '@/lib/partner/auth';
import { getRazorpayClient } from '@/lib/razorpay';
import { decrypt } from '@/lib/encryption';
import { connectDB } from '@/lib/db';

/**
 * POST /api/v1/partner/orders/razorpay/verify
 * Verifies Razorpay payment signature and updates order status
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
    if (!checkPartnerPermission(context, 'orders', 'write')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'You do not have permission to verify payments',
          },
        },
        { status: 403, headers: corsHeaders }
      );
    }

    const body = await request.json();

    // Validate required fields
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body;

    if (!razorpay_payment_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'razorpay_payment_id is required',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!razorpay_order_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'razorpay_order_id is required',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!razorpay_signature) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'razorpay_signature is required',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Determine secret to verify signature: prefer partner credentials when available
    let secretToUse = process.env.RAZORPAY_KEY_SECRET || ''
    let rpClient: any = null
    try {
      const env = (request.partner as any)?.razorpayIntegration?.defaultEnvironment || 'test'
      const creds = (request.partner as any)?.razorpayIntegration?.credentials?.[env]
      if (creds && creds.keySecretEnc && creds.keySecretIv && creds.keySecretTag) {
        const secret = decrypt(creds.keySecretEnc, creds.keySecretIv, creds.keySecretTag)
        if (secret) {
          secretToUse = secret
          if (creds.keyId) {
            try {
              rpClient = getRazorpayClient({ keyId: creds.keyId, keySecret: secret })
            } catch (e) {
              rpClient = null
            }
          }
        }
      }
    } catch (e) {
      rpClient = null
    }

    // Verify the payment signature
    const signatureBody = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', secretToUse)
      .update(signatureBody)
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      console.error(`[Partner API] Invalid Razorpay signature for order ${razorpay_order_id}`);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SIGNATURE_VERIFICATION_FAILED',
            message: 'Payment signature verification failed',
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch payment details from Razorpay
    let paymentDetails;
    let orderDetails;
    try {
      const rp = rpClient || getRazorpayClient()
      paymentDetails = await rp.payments.fetch(razorpay_payment_id);
      orderDetails = await rp.orders.fetch(razorpay_order_id);
    } catch (fetchError: any) {
      console.error('[Partner API] Failed to fetch Razorpay details:', fetchError);
    }

    const db = await connectDB();

    // Update partner_payments record
    const updateResult = await db.collection('partner_payments').findOneAndUpdate(
      {
        razorpayOrderId: razorpay_order_id,
        partnerId: context.partner.id,
      },
      {
        $set: {
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: 'paid',
          paymentMethod: paymentDetails?.method || 'unknown',
          paymentDetails: paymentDetails ? {
            method: paymentDetails.method,
            bank: paymentDetails.bank,
            wallet: paymentDetails.wallet,
            vpa: paymentDetails.vpa,
            email: paymentDetails.email,
            contact: paymentDetails.contact,
          } : null,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    // Record payment verification
    await db.collection('partner_payment_verifications').insertOne({
      partnerId: context.partner.id,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      verified: true,
      verifiedAt: new Date(),
      amount: paymentDetails?.amount ? Number(paymentDetails.amount) / 100 : null,
      method: paymentDetails?.method || 'unknown',
    });

    console.log(`[Partner API] Payment verified: ${razorpay_payment_id} for partner ${context.partner.id}`);

    return NextResponse.json(
      {
        success: true,
        data: {
          verified: true,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          amount: paymentDetails?.amount ? Number(paymentDetails.amount) / 100 : null,
          currency: paymentDetails?.currency || orderDetails?.currency || 'INR',
          status: paymentDetails?.status || 'captured',
          method: paymentDetails?.method || 'unknown',
          orderId: orderDetails?.notes?.orderId || updateResult?.orderId || null,
          paidAt: paymentDetails?.created_at 
            ? new Date(Number(paymentDetails.created_at) * 1000).toISOString() 
            : new Date().toISOString(),
        },
        requestId: context.requestId,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[Partner API] Razorpay verify error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to verify payment',
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
