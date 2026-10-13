import { ObjectId, type ClientSession } from 'mongodb';
import { getCollection } from '@/lib/db-service';
import { PartnerOrderItemsSchema } from '@/lib/validation';
import type { PartnerOrder, PartnerOrderItem } from './types';

export interface PartnerCatalogueProduct {
  id?: string;
  name?: string;
  sku?: string;
  price?: number;
  stock?: number;
  active?: boolean;
}

export class PartnerCheckoutError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = 'PartnerCheckoutError';
  }
}

export async function pricePartnerOrder(
  input: Array<{ productId: string; quantity: number }>,
  session?: ClientSession,
): Promise<{ items: PartnerOrderItem[]; summary: PartnerOrder['summary'] }> {
  const parsed = PartnerOrderItemsSchema.safeParse(input);
  if (!parsed.success) throw new PartnerCheckoutError('Invalid order items');
  const products = await getCollection<PartnerCatalogueProduct>('products');
  const items: PartnerOrderItem[] = [];
  const seen = new Set<string>();
  let subtotalPaise = 0;
  for (const item of parsed.data) {
    const product = await products.findOne({
      $or: ObjectId.isValid(item.productId) ? [{ _id: new ObjectId(item.productId) }, { id: item.productId }] : [{ id: item.productId }],
      active: true,
    }, { session });
    if (!product) throw new PartnerCheckoutError(`Product ${item.productId} not found or inactive`);
    const id = product._id.toString();
    if (seen.has(id)) throw new PartnerCheckoutError('Duplicate product aliases must be combined');
    seen.add(id);
    if (!Number.isSafeInteger(product.stock) || product.stock === undefined || product.stock < item.quantity) {
      throw new PartnerCheckoutError(`Insufficient stock for product ${item.productId}`);
    }
    if (typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price <= 0 || product.price > 10000000) {
      throw new PartnerCheckoutError(`Product ${item.productId} has invalid pricing`);
    }
    const pricePaise = Math.round(product.price * 100);
    if (pricePaise <= 0) throw new PartnerCheckoutError(`Product ${item.productId} has invalid pricing`);
    const itemPaise = pricePaise * item.quantity;
    subtotalPaise += itemPaise;
    items.push({ productId: id, name: product.name || '', sku: product.sku || '', price: pricePaise / 100, quantity: item.quantity, subtotal: itemPaise / 100 });
  }
  const taxPaise = Math.round(subtotalPaise * 0.18);
  const totalPaise = subtotalPaise + taxPaise;
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || totalPaise > 1000000000) {
    throw new PartnerCheckoutError('Order total exceeds the supported payment amount');
  }
  return { items, summary: { subtotal: subtotalPaise / 100, tax: taxPaise / 100, shipping: 0, total: totalPaise / 100 } };
}

export function samePartnerItems(left: PartnerOrderItem[], right: PartnerOrderItem[]): boolean {
  const key = (items: PartnerOrderItem[]) => JSON.stringify(
    items.map(item => [item.productId, item.quantity, Math.round(item.price * 100)]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
  return key(left) === key(right);
}
