import { NextResponse } from 'next/server';
import { ObjectId, type Filter } from 'mongodb';
import crypto from 'crypto';
import { getCollection } from '@/lib/db-service';
import { connectToDatabase } from '@/lib/mongodb';
import { ExternalOrderWebhookSchema } from '@/lib/validation';
import { FulfillmentError, type ExternalFulfillmentRecord } from '@/lib/external-fulfillment';

interface WebhookOrder {
  orderId?: string;
  updatedAt?: Date;
  timeline?: Array<{ date: string; status: string; description: string }>;
  externalFulfillment?: { status: string; updatedAt: Date; lastWebhookStatus?: string };
}

export async function POST(request: Request) {
  const secret = process.env.EXLR8_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[eXlr8 Webhook] Shared secret is not configured');
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  }
  const incoming = Buffer.from(request.headers.get('x-webhook-secret') || '');
  const expected = Buffer.from(secret);
  if (incoming.length !== expected.length || !crypto.timingSafeEqual(incoming, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ExternalOrderWebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  const hash = crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
  try {
    const external = await getCollection<ExternalFulfillmentRecord>('external_orders');
    const orders = await getCollection<WebhookOrder>('orders');
    const filter: Filter<ExternalFulfillmentRecord> = input.queueId
      ? { $or: [
        { _id: input.queueId }, { queueId: input.queueId },
        ...(ObjectId.isValid(input.queueId) ? [{ _id: new ObjectId(input.queueId) }] : []),
      ] }
      : input.externalOrderId ? { $or: [
        { externalOrderId: input.externalOrderId },
        { 'response.data.orderID': input.externalOrderId }, { 'response.data.orderId': input.externalOrderId },
      ] } : { orderId: input.orderId };
    const { client } = await connectToDatabase();
    const session = client.startSession();
    try {
      const result = await session.withTransaction(async () => {
        const matches = await external.find(filter, { session }).limit(2).toArray();
        if (matches.length > 1) throw new FulfillmentError('Ambiguous fulfillment reference; supply a unique queueId or externalOrderId', 409);
        const record = matches[0];
        if (!record?.orderId || (record.provider && !['exlr8', 'kgen'].includes(record.provider)) ||
            (input.orderId && input.orderId !== record.orderId) ||
            (input.externalOrderId && record.externalOrderId && input.externalOrderId !== record.externalOrderId)) {
          throw new FulfillmentError('No matching external fulfillment record', 404);
        }
        const order = await orders.findOne(ObjectId.isValid(record.orderId)
          ? { $or: [{ _id: new ObjectId(record.orderId) }, { orderId: record.orderId }] }
          : { orderId: record.orderId }, { session });
        if (!order) throw new FulfillmentError('Linked order not found; reconciliation is required', 409);
        if (record.lastWebhookHash === hash) return { success: true, duplicate: true };
        if (record.status && ['fulfilled', 'delivered', 'completed', 'cancelled'].includes(record.status) && record.status !== input.status) {
          return { success: true, ignored: true, note: 'Terminal fulfillment state preserved' };
        }
        const now = new Date();
        const updated = await external.updateOne({ _id: record._id }, {
          $set: {
            status: input.status, webhookResponse: { message: input.message || null, payload: input.payload ?? null },
            ...(input.externalOrderId ? { externalOrderId: input.externalOrderId } : {}),
            lastWebhookHash: hash, updatedAt: now,
          },
          $inc: { webhookAttempts: 1 },
        }, { session });
        if (updated.matchedCount !== 1) throw new FulfillmentError('External fulfillment record changed; retry callback', 409);
        // A unit/provider callback is not proof of whole-order payment or delivery.
        const linked = await orders.updateOne({ _id: order._id }, {
          $set: { updatedAt: now, ...(order.externalFulfillment ? {
            'externalFulfillment.lastWebhookStatus': input.status,
            'externalFulfillment.updatedAt': now,
          } : {}) },
          $push: { timeline: { date: now.toISOString(), status: `External: ${input.status}`, description: input.message || `External provider status: ${input.status}` } },
        }, { session });
        if (linked.matchedCount !== 1) throw new FulfillmentError('Linked order changed; reconciliation is required', 409);
        return { success: true };
      });
      if (!result) throw new Error('Webhook transaction did not commit');
      return NextResponse.json(result);
    } finally {
      await session.endSession();
    }
  } catch (error) {
    if (error instanceof FulfillmentError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('[eXlr8 Webhook] Processing failed:', error instanceof Error ? error.message : 'Unexpected database failure');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
