/**
 * Partner Orders Service
 * Handles order creation, management, and cancellation for partner API
 */

import { ObjectId, type Filter, type WithId } from 'mongodb';
import { getCollection } from '@/lib/db-service';
import { connectToDatabase } from '@/lib/mongodb';
import { generateOrderId } from '@/lib/order-id';
import { PartnerOrderCreateSchema } from '@/lib/validation';
import type { z } from 'zod';
import {
  PartnerOrder,
  PartnerOrderStatus,
  Partner,
  APIKeyEnvironment,
  PARTNER_COMMISSION_RATES,
} from './types';
import { pricePartnerOrder, samePartnerItems, PartnerCheckoutError, type PartnerCatalogueProduct } from './order-pricing';
import type { PartnerPayment } from './payments';

// Collection names
const ORDERS_COLLECTION = 'partner_orders';
const PRODUCTS_COLLECTION = 'products';

type StoredPartnerOrder = Omit<PartnerOrder, 'id'> & { id?: string };
export type CreateOrderInput = z.infer<typeof PartnerOrderCreateSchema>;

/**
 * Normalize order from database
 */
function normalizeOrder(doc: WithId<StoredPartnerOrder>): PartnerOrder {
  return {
    id: doc._id.toString(),
    orderId: doc.orderId,
    partnerId: doc.partnerId,
    partnerOrderId: doc.partnerOrderId,
    customer: doc.customer,
    items: doc.items,
    summary: doc.summary,
    paymentMethod: doc.paymentMethod,
    status: doc.status,
    statusHistory: doc.statusHistory || [],
    commission: doc.commission,
    tracking: doc.tracking,
    notes: doc.notes,
    paymentDetails: doc.paymentDetails || undefined,
    paymentVerification: doc.paymentVerification || { verified: false },
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    deliveredAt: doc.deliveredAt ? new Date(doc.deliveredAt) : undefined,
    cancelledAt: doc.cancelledAt ? new Date(doc.cancelledAt) : undefined,
  };
}

/**
 * Create a new partner order
 */
export async function createPartnerOrder(
  partner: Partner,
  input: CreateOrderInput,
  environment: APIKeyEnvironment,
): Promise<{ success: boolean; order?: PartnerOrder; error?: string; status?: number; testMode?: boolean }> {
  if (environment !== 'live' && environment !== 'test') return { success: false, error: 'Invalid API key environment', status: 403 };
  const parsed = PartnerOrderCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid order input', status: 400 };
  const orderData = parsed.data;
  const { client } = await connectToDatabase();
  const session = client.startSession();
  try {
    const orderId = environment === 'test' ? `TEST-${new ObjectId().toString()}` : await generateOrderId();
    const result = await session.withTransaction(async () => {
      const quote = await pricePartnerOrder(orderData.items, session);
      const payments = await getCollection<PartnerPayment>('partner_payments');
      const proof = orderData.paymentMethod === 'prepaid' && orderData.paymentDetails
        ? await payments.findOne({
          partnerId: partner.id, environment, status: 'paid',
          razorpayOrderId: orderData.paymentDetails.razorpayOrderId,
          razorpayPaymentId: orderData.paymentDetails.transactionId,
          consumedOrderId: { $exists: false },
        }, { session }) : null;
      if (orderData.paymentMethod === 'prepaid' && (!proof || !proof.verifiedAt || !proof.keyId ||
          proof.currency !== 'INR' || Math.round(proof.amount * 100) !== Math.round(quote.summary.total * 100) ||
          !proof.items?.length || !samePartnerItems(proof.items, quote.items) ||
          (orderData.partnerOrderId && orderData.partnerOrderId !== proof.orderId))) {
        throw new PartnerCheckoutError('A verified, unused payment for this partner, environment and item quote is required', 409);
      }
      const commissionRate = partner.commissionRate ?? PARTNER_COMMISSION_RATES[partner.tier];
      if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) throw new PartnerCheckoutError('Invalid partner commission configuration');
      const now = new Date();
      const order: Omit<PartnerOrder, 'id'> & { _id: ObjectId } = {
        _id: new ObjectId(),
        orderId,
        partnerId: partner.id,
        partnerOrderId: proof?.orderId || orderData.partnerOrderId,
        customer: orderData.customer,
        items: quote.items,
        summary: quote.summary,
        paymentMethod: orderData.paymentMethod,
        status: 'pending',
        statusHistory: [{ status: 'pending', timestamp: now }],
        commission: {
          rate: commissionRate,
          amount: Math.round(quote.summary.subtotal * commissionRate) / 100,
          status: 'pending',
        },
        notes: orderData.notes,
        paymentDetails: proof ? {
          razorpayOrderId: proof.razorpayOrderId, transactionId: proof.razorpayPaymentId,
          amount: proof.amount, method: proof.paymentMethod,
        } : undefined,
        paymentVerification: proof ? { verified: true, verifiedAt: proof.verifiedAt, verifiedBy: 'Razorpay' } : { verified: false },
        createdAt: now,
        updatedAt: now,
      };
      if (proof) {
        const claimed = await payments.updateOne({
          _id: proof._id, partnerId: partner.id, environment, status: 'paid', consumedOrderId: { $exists: false },
        }, { $set: { consumedOrderId: orderId, updatedAt: now } }, { session });
        if (claimed.modifiedCount !== 1) throw new PartnerCheckoutError('Payment has already been used', 409);
      }
      if (environment === 'live') {
        const products = await getCollection<PartnerCatalogueProduct>(PRODUCTS_COLLECTION);
        for (const item of quote.items) {
          const reserved = await products.updateOne({
            _id: new ObjectId(item.productId), active: true, stock: { $gte: item.quantity },
          }, { $inc: { stock: -item.quantity }, $set: { updatedAt: now } }, { session });
          if (reserved.modifiedCount !== 1) throw new PartnerCheckoutError('Stock or price changed; retry checkout', 409);
        }
        const orders = await getCollection<StoredPartnerOrder>(ORDERS_COLLECTION);
        await orders.insertOne(order, { session });
      }
      return { success: true, order: normalizeOrder(order), testMode: environment === 'test' };
    });
    if (!result) throw new Error('Partner checkout transaction did not commit');
    return result;
  } catch (error) {
    if (error instanceof PartnerCheckoutError) return { success: false, error: error.message, status: error.status };
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Get order by ID for a partner
 */
export async function getPartnerOrderById(
  partnerId: string,
  orderId: string
): Promise<PartnerOrder | null> {
  const collection = await getCollection<StoredPartnerOrder>(ORDERS_COLLECTION);

  const order = await collection.findOne({
    partnerId,
    orderId,
  });

  if (!order) {
    return null;
  }

  return normalizeOrder(order);
}

/**
 * Get order by internal ID or external partner order ID
 */
export async function getPartnerOrderByIdOrExternalId(
  partnerId: string,
  qid: string
): Promise<PartnerOrder | null> {
  const collection = await getCollection<StoredPartnerOrder>(ORDERS_COLLECTION);

  const order = await collection.findOne({
    partnerId,
    $or: [
      { orderId: qid },
      { partnerOrderId: qid }
    ]
  });

  if (!order) {
    return null;
  }

  return normalizeOrder(order);
}

/**
 * List partner orders with filters
 */
export async function listPartnerOrders(
  partnerId: string,
  options?: {
    status?: PartnerOrderStatus;
    page?: number;
    limit?: number;
  }
): Promise<{
  orders: PartnerOrder[];
  total: number;
  page: number;
  limit: number;
}> {
  const collection = await getCollection<StoredPartnerOrder>(ORDERS_COLLECTION);

  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 20, 100);
  const skip = (page - 1) * limit;

  const filter: Filter<StoredPartnerOrder> = { partnerId };
  if (options?.status) {
    filter.status = options.status;
  }

  const [orders, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    orders: orders.map(normalizeOrder),
    total,
    page,
    limit,
  };
}

/**
 * Cancel a partner order
 */
export async function cancelPartnerOrder(
  partnerId: string,
  orderId: string,
  environment: APIKeyEnvironment,
  reason?: string
): Promise<{ success: boolean; order?: PartnerOrder; error?: string; status?: number }> {
  if (environment !== 'live') return { success: false, error: 'Test API keys cannot cancel live fulfillment orders', status: 403 };
  const collection = await getCollection<StoredPartnerOrder>(ORDERS_COLLECTION);
  const { client } = await connectToDatabase();
  const session = client.startSession();
  try {
    const result = await session.withTransaction(async () => {
      const now = new Date();
      const order = await collection.findOneAndUpdate({
        partnerId, orderId, status: { $in: ['pending', 'confirmed', 'processing'] },
      }, {
        $set: { status: 'cancelled', cancelledAt: now, updatedAt: now },
        $push: { statusHistory: { status: 'cancelled', timestamp: now, details: { reason: reason || 'Cancelled by partner' } } },
      }, { returnDocument: 'after', session });
      if (!order) {
        const existing = await collection.findOne({ partnerId, orderId }, { session });
        throw new PartnerCheckoutError(existing ? `Cannot cancel order with status: ${existing.status}` : 'Order not found', existing ? 409 : 404);
      }
      const products = await getCollection<PartnerCatalogueProduct>(PRODUCTS_COLLECTION);
      for (const item of order.items) {
        if (!ObjectId.isValid(item.productId) || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
          throw new PartnerCheckoutError('Stored order items require administrator reconciliation', 409);
        }
        const released = await products.updateOne({ _id: new ObjectId(item.productId) }, {
          $inc: { stock: item.quantity }, $set: { updatedAt: now },
        }, { session });
        if (released.matchedCount !== 1) throw new PartnerCheckoutError('Reserved product is missing; administrator reconciliation is required', 409);
      }
      return { success: true, order: normalizeOrder(order) };
    });
    if (!result) throw new Error('Partner cancellation transaction did not commit');
    return result;
  } catch (error) {
    if (error instanceof PartnerCheckoutError) return { success: false, error: error.message, status: error.status };
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: PartnerOrderStatus,
  details?: Record<string, unknown>
): Promise<PartnerOrder | null> {
  const collection = await getCollection<StoredPartnerOrder>(ORDERS_COLLECTION);

  const updateData: Partial<StoredPartnerOrder> = {
    status,
    updatedAt: new Date(),
  };

  // Add timestamp based on status
  if (status === 'delivered') {
    updateData.deliveredAt = new Date();
  } else if (status === 'cancelled') {
    updateData.cancelledAt = new Date();
  }

  const result = await collection.findOneAndUpdate(
    { orderId },
    {
      $set: updateData,
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
          details,
        },
      },
    },
    { returnDocument: 'after' }
  );

  if (!result) {
    return null;
  }

  return normalizeOrder(result);
}

/**
 * Get order statistics for a partner
 */
export async function getPartnerOrderStats(
  partnerId: string
): Promise<{
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalCommission: number;
}> {
  const collection = await getCollection<StoredPartnerOrder>(ORDERS_COLLECTION);

  const stats = await collection.aggregate([
    { $match: { partnerId } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        completedOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] },
        },
        cancelledOrders: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
        },
        pendingOrders: {
          $sum: { $cond: [{ $in: ['$status', ['pending', 'confirmed', 'processing']] }, 1, 0] },
        },
        totalRevenue: {
          $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$summary.total', 0] },
        },
        totalCommission: {
          $sum: { $cond: [{ $ne: ['$status', 'cancelled'] }, '$commission.amount', 0] },
        },
      },
    },
  ]).toArray();

  if (stats.length === 0) {
    return {
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      pendingOrders: 0,
      totalRevenue: 0,
      totalCommission: 0,
    };
  }

  return {
    totalOrders: stats[0].totalOrders,
    completedOrders: stats[0].completedOrders,
    cancelledOrders: stats[0].cancelledOrders,
    pendingOrders: stats[0].pendingOrders,
    totalRevenue: stats[0].totalRevenue,
    totalCommission: stats[0].totalCommission,
  };
}
