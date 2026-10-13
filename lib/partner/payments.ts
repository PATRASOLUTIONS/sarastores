import crypto from 'crypto';
import { getCollection } from '@/lib/db-service';
import { decrypt } from '@/lib/encryption';
import { getRazorpayClient } from '@/lib/razorpay';
import type { z } from 'zod';
import type { PartnerPaymentCreateSchema, PartnerPaymentVerifySchema } from '@/lib/validation';
import type { APIKeyEnvironment, Partner, PartnerOrderItem } from './types';
import { PartnerCheckoutError, pricePartnerOrder } from './order-pricing';

export interface PartnerPayment {
  partnerId: string;
  orderId: string;
  environment: APIKeyEnvironment;
  keyId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: number;
  currency: 'INR';
  items: PartnerOrderItem[];
  status: 'created' | 'paid';
  paymentMethod?: string;
  verifiedAt?: Date;
  consumedOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

function paymentContext(partner: Partner, environment: APIKeyEnvironment, expectedKeyId?: string) {
  if (environment !== 'test' && environment !== 'live') throw new PartnerCheckoutError('Invalid API key environment', 403);
  const integration = partner.razorpayIntegration;
  const credentials = integration?.credentials?.[environment];
  if (!integration?.enabled || !credentials?.keyId || !credentials.keySecretEnc || !credentials.keySecretIv || !credentials.keySecretTag) {
    throw new PartnerCheckoutError('Razorpay credentials are not configured for this API key environment', 503);
  }
  if (!credentials.keyId.startsWith(`rzp_${environment}_`) || (expectedKeyId && credentials.keyId !== expectedKeyId)) {
    throw new PartnerCheckoutError('Razorpay account does not match the payment environment or original account', 409);
  }
  const secret = decrypt(credentials.keySecretEnc, credentials.keySecretIv, credentials.keySecretTag);
  if (!secret) throw new PartnerCheckoutError('Unable to decrypt configured Razorpay credentials', 503);
  return { client: getRazorpayClient({ keyId: credentials.keyId, keySecret: secret }), keyId: credentials.keyId, secret };
}

export async function createPartnerPayment(partner: Partner, environment: APIKeyEnvironment, input: z.infer<typeof PartnerPaymentCreateSchema>) {
  const quote = await pricePartnerOrder(input.items);
  const { client, keyId } = paymentContext(partner, environment);
  const amount = Math.round(quote.summary.total * 100);
  const receipt = input.receipt || `partner_${crypto.randomUUID().replace(/-/g, '').slice(0, 28)}`;
  const order = await client.orders.create({
    amount, currency: 'INR', receipt,
    notes: { ...input.notes, partnerId: partner.id, orderId: input.orderId, environment },
  });
  if (!/^order_[A-Za-z0-9]+$/.test(order.id) || Number(order.amount) !== amount || order.currency !== 'INR' || order.status !== 'created') {
    throw new PartnerCheckoutError('Razorpay returned an inconsistent order', 502);
  }
  const payments = await getCollection<PartnerPayment>('partner_payments');
  const now = new Date();
  await payments.insertOne({
    partnerId: partner.id, orderId: input.orderId, environment, keyId, razorpayOrderId: order.id,
    items: quote.items, amount: amount / 100, currency: 'INR', status: 'created', createdAt: now, updatedAt: now,
  });
  return {
    razorpayOrderId: order.id, amount, amountInRupees: amount / 100, currency: 'INR',
    receipt: order.receipt, status: order.status, keyId, notes: order.notes, environment,
  };
}

export async function verifyPartnerPayment(partner: Partner, environment: APIKeyEnvironment, input: z.infer<typeof PartnerPaymentVerifySchema>) {
  const payments = await getCollection<PartnerPayment>('partner_payments');
  const stored = await payments.findOne({ partnerId: partner.id, environment, razorpayOrderId: input.razorpay_order_id });
  // Old initiations lack a server quote/account/environment binding and cannot be promoted.
  if (!stored || !stored.keyId || !stored.items?.length || !Number.isFinite(stored.amount) || stored.amount <= 0 || stored.currency !== 'INR') {
    throw new PartnerCheckoutError('Bound payment initiation not found', 404);
  }
  if (stored.razorpayPaymentId && stored.razorpayPaymentId !== input.razorpay_payment_id) {
    throw new PartnerCheckoutError('A different payment has already been verified for this order', 409);
  }
  const { client, secret } = paymentContext(partner, environment, stored.keyId);
  const expected = crypto.createHmac('sha256', secret).update(`${stored.razorpayOrderId}|${input.razorpay_payment_id}`).digest();
  const supplied = Buffer.from(input.razorpay_signature, 'hex');
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(expected, supplied)) {
    throw new PartnerCheckoutError('Payment signature verification failed');
  }
  // Provider failures must abort verification, never produce a success-shaped fallback.
  const [payment, order] = await Promise.all([
    client.payments.fetch(input.razorpay_payment_id),
    client.orders.fetch(stored.razorpayOrderId),
  ]);
  const amount = Math.round(stored.amount * 100);
  if (payment.id !== input.razorpay_payment_id || payment.status !== 'captured' ||
      payment.order_id !== stored.razorpayOrderId || Number(payment.amount) !== amount || payment.currency !== stored.currency ||
      order.id !== stored.razorpayOrderId || Number(order.amount) !== amount || order.currency !== stored.currency ||
      order.status !== 'paid' || Number(order.amount_paid) !== amount ||
      order.notes?.partnerId !== partner.id || order.notes?.orderId !== stored.orderId || order.notes?.environment !== environment ||
      !Number.isSafeInteger(Number(payment.created_at)) || Number(payment.created_at) <= 0) {
    throw new PartnerCheckoutError('Captured payment does not match the original partner quote', 409);
  }
  const now = new Date();
  const result = await payments.updateOne({
    _id: stored._id, partnerId: partner.id, environment,
    $or: [{ status: 'created', razorpayPaymentId: { $exists: false } }, { status: 'paid', razorpayPaymentId: payment.id }],
  }, { $set: { status: 'paid', razorpayPaymentId: payment.id, paymentMethod: payment.method, verifiedAt: stored.verifiedAt || now, updatedAt: now } });
  if (result.matchedCount !== 1) throw new PartnerCheckoutError('Payment verification conflicted with another request', 409);
  return {
    verified: true, razorpayPaymentId: payment.id, razorpayOrderId: stored.razorpayOrderId,
    amount: stored.amount, currency: stored.currency, status: payment.status, method: payment.method,
    orderId: stored.orderId, paidAt: new Date(Number(payment.created_at) * 1000).toISOString(),
  };
}
