/**
 * Partner Orders Service
 * Handles order creation, management, and cancellation for partner API
 */

import { ObjectId } from 'mongodb';
import { getCollection } from '@/lib/db-service';
import { generateOrderId } from '@/lib/order-id';
import {
  PartnerOrder,
  PartnerOrderItem,
  PartnerOrderStatus,
  Partner,
  PartnerAPIKey,
  Address,
  PARTNER_COMMISSION_RATES,
} from './types';
import { createTransaction } from './wallet';

// Collection names
const ORDERS_COLLECTION = 'partner_orders';
const PRODUCTS_COLLECTION = 'products';

/**
 * Create order request interface
 */
export interface CreateOrderInput {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: Address;
  };
  paymentMethod: 'prepaid' | 'cod';
  partnerOrderId?: string;
  notes?: string;
  paymentDetails?: {
    razorpayOrderId?: string;
    transactionId?: string;
    method?: string;
    amount?: number;
  };
}

/**
 * Validate products and calculate pricing
 */
async function validateAndPriceItems(
  items: CreateOrderInput['items']
): Promise<{
  valid: boolean;
  errors: string[];
  validatedItems: PartnerOrderItem[];
  subtotal: number;
}> {
  const collection = await getCollection(PRODUCTS_COLLECTION);
  const errors: string[] = [];
  const validatedItems: PartnerOrderItem[] = [];
  let subtotal = 0;

  for (const item of items) {
    let product: any;

    try {
      product = await collection.findOne({
        $or: [
          { _id: new ObjectId(item.productId) },
          { id: item.productId },
        ],
        active: true,
      });
    } catch (e) {
      product = await collection.findOne({
        id: item.productId,
        active: true,
      });
    }

    if (!product) {
      errors.push(`Product ${item.productId} not found or inactive`);
      continue;
    }

    if ((product.stock || 0) < item.quantity) {
      errors.push(
        `Insufficient stock for ${product.name}. Available: ${product.stock || 0}`
      );
      continue;
    }

    const price = product.price || 0;
    const itemSubtotal = price * item.quantity;
    subtotal += itemSubtotal;

    validatedItems.push({
      productId: product._id.toString(),
      name: product.name || '',
      sku: product.sku || '',
      price,
      quantity: item.quantity,
      subtotal: itemSubtotal,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    validatedItems,
    subtotal,
  };
}

/**
 * Reserve stock for order items
 */
async function reserveStock(items: PartnerOrderItem[]): Promise<boolean> {
  const collection = await getCollection(PRODUCTS_COLLECTION);

  try {
    for (const item of items) {
      const result = await collection.updateOne(
        {
          _id: new ObjectId(item.productId),
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
          $set: { updatedAt: new Date() },
        }
      );

      if (result.modifiedCount === 0) {
        // Rollback previous reservations
        await releaseStock(items.slice(0, items.indexOf(item)));
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('[Partner Orders] Stock reservation error:', error);
    return false;
  }
}

/**
 * Release reserved stock
 */
async function releaseStock(items: PartnerOrderItem[]): Promise<void> {
  const collection = await getCollection(PRODUCTS_COLLECTION);

  for (const item of items) {
    try {
      await collection.updateOne(
        { _id: new ObjectId(item.productId) },
        {
          $inc: { stock: item.quantity },
          $set: { updatedAt: new Date() },
        }
      );
    } catch (error) {
      console.error('[Partner Orders] Stock release error:', error);
    }
  }
}

/**
 * Normalize order from database
 */
function normalizeOrder(doc: any): PartnerOrder {
  return {
    id: doc._id?.toString() || doc.id,
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
  orderData: CreateOrderInput
): Promise<{ success: boolean; order?: PartnerOrder; error?: string }> {
  // Validate products
  const validation = await validateAndPriceItems(orderData.items);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join('; '),
    };
  }

  // Calculate order amounts
  const subtotal = validation.subtotal;
  const tax = Math.round(subtotal * 0.18 * 100) / 100; // 18% GST
  const shipping = 0; // Free shipping for now
  const total = subtotal + tax + shipping;

  // Calculate commission
  const commissionRate = partner.commissionRate || PARTNER_COMMISSION_RATES[partner.tier];
  const commissionAmount = Math.round(subtotal * (commissionRate / 100) * 100) / 100;

  // Reserve stock
  const stockReserved = await reserveStock(validation.validatedItems);
  if (!stockReserved) {
    return {
      success: false,
      error: 'Failed to reserve stock. Some items may be out of stock.',
    };
  }

  try {
    const ordersCollection = await getCollection(ORDERS_COLLECTION);
    const orderId = await generateOrderId();

    const order: Omit<PartnerOrder, 'id'> & { _id: ObjectId } = {
      _id: new ObjectId(),
      orderId,
      partnerId: partner.id,
      partnerOrderId: orderData.partnerOrderId,
      customer: orderData.customer,
      items: validation.validatedItems,
      summary: {
        subtotal,
        tax,
        shipping,
        total,
      },
      paymentMethod: orderData.paymentMethod,
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          timestamp: new Date(),
        },
      ],
      commission: {
        rate: commissionRate,
        amount: commissionAmount,
        status: 'pending',
      },
      notes: orderData.notes,
      paymentDetails: orderData.paymentMethod === 'prepaid'
        ? {
          ...orderData.paymentDetails,
          amount: orderData.paymentDetails?.amount || total
        }
        : orderData.paymentDetails || undefined,
      paymentVerification: {
        verified: false,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await ordersCollection.insertOne(order);

    return {
      success: true,
      order: normalizeOrder(order),
    };
  } catch (error) {
    // Rollback stock reservation on failure
    await releaseStock(validation.validatedItems);
    console.error('[Partner Orders] Order creation error:', error);
    return {
      success: false,
      error: 'Failed to create order',
    };
  }
}

/**
 * Get order by ID for a partner
 */
export async function getPartnerOrderById(
  partnerId: string,
  orderId: string
): Promise<PartnerOrder | null> {
  const collection = await getCollection(ORDERS_COLLECTION);

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
  const collection = await getCollection(ORDERS_COLLECTION);

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
  const collection = await getCollection(ORDERS_COLLECTION);

  const page = options?.page || 1;
  const limit = Math.min(options?.limit || 20, 100);
  const skip = (page - 1) * limit;

  const filter: any = { partnerId };
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
  reason?: string
): Promise<{ success: boolean; order?: PartnerOrder; error?: string }> {
  const collection = await getCollection(ORDERS_COLLECTION);

  const order = await collection.findOne({
    partnerId,
    orderId,
  });

  if (!order) {
    return {
      success: false,
      error: 'Order not found',
    };
  }

  // Check if order can be cancelled
  const cancellableStatuses: PartnerOrderStatus[] = ['pending', 'confirmed', 'processing'];
  if (!cancellableStatuses.includes(order.status)) {
    return {
      success: false,
      error: `Cannot cancel order with status: ${order.status}`,
    };
  }

  // Release stock
  await releaseStock(order.items);

  // Update order status
  const result = await collection.findOneAndUpdate(
    { partnerId, orderId } as any,
    {
      $set: {
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      },
      $push: {
        statusHistory: {
          status: 'cancelled',
          timestamp: new Date(),
          details: { reason: reason || 'Cancelled by partner' },
        },
      },
    } as any,
    { returnDocument: 'after' }
  );

  if (!result) {
    return {
      success: false,
      error: 'Failed to cancel order',
    };
  }

  return {
    success: true,
    order: normalizeOrder(result),
  };
}

/**
 * Update order status
 */
export async function updateOrderStatus(
  orderId: string,
  status: PartnerOrderStatus,
  details?: Record<string, any>
): Promise<PartnerOrder | null> {
  const collection = await getCollection(ORDERS_COLLECTION);

  const updateData: any = {
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
    { orderId } as any,
    {
      $set: updateData,
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
          details,
        },
      },
    } as any,
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
  const collection = await getCollection(ORDERS_COLLECTION);

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
