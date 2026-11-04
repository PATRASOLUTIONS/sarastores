import { createHash, randomUUID } from 'node:crypto'
import type { ClientSession } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import { COLLECTIONS, getConfig, initializeDiwali, type Claim } from './service'
import { onlineGift, ONLINE_STORE, type OnlineGift } from './online-rules'
import { indiaDate, normalizeInvoice } from './rules'

type Customer = { name: string; phone: string | null; address: string; city: string; state: string; zipCode: string; email: string }
export type OnlineDiwaliOrder = {
  orderId: string; userId: string | null; paymentMethod: string; total: number; shipping: number;
  customer: Customer; createdAt: Date; diwaliGift?: OnlineGift | null;
  shippingAddress?: { street: string; city: string; state: string; zip: string };
  fulfilment?: { method: string; storeName?: string };
}
export async function prepareOnlineDiwaliOrder(order: OnlineDiwaliOrder) {
  if (order.paymentMethod === 'instore') return null
  const gift = onlineGift(await getConfig(), order.total, order.shipping, order.createdAt)
  if (gift) await initializeDiwali()
  return gift
}
// Called in the order transaction: one persisted order produces one claim, even on retries.
export async function recordOnlineDiwaliOrder(order: OnlineDiwaliOrder, session: ClientSession) {
  const gift = order.diwaliGift
  if (!gift) return
  const id = `online:${order.orderId}`
  const requestKey = createHash('sha256').update(id).digest('hex')
  const invoice = normalizeInvoice(order.orderId)
  const claim: Claim = {
    _id: id, reference: `SARA-DIW-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`,
    source: 'online', orderId: order.orderId, userId: order.userId, invoice,
    invoiceKey: `${ONLINE_STORE}:${invoice}`, requestKey, storeCode: ONLINE_STORE,
    name: order.customer.name, mobile: order.customer.phone || '', email: order.customer.email,
    address: order.shippingAddress?.street || order.customer.address, city: order.shippingAddress?.city || order.customer.city,
    district: '', state: order.shippingAddress?.state || order.customer.state,
    pincode: order.shippingAddress?.zip || order.customer.zipCode, enteredValue: gift.eligibleValue, giftCode: gift.giftCode,
    deliveryMethod: order.fulfilment?.method || 'delivery', pickupStoreName: order.fulfilment?.storeName || '',
    invoiceDate: indiaDate(order.createdAt), language: 'en', whatsappConsent: false,
    consent: { version: gift.consentVersion, whatsapp: false, at: order.createdAt, language: 'en', source: 'checkout' },
    status: 'pending', fulfilment: 'pending', version: 0, createdAt: order.createdAt, updatedAt: order.createdAt,
  }
  const result = await (await getCollection<Claim>(COLLECTIONS.claims)).updateOne(
    { _id: id }, { $setOnInsert: claim }, { session, upsert: true },
  )
  if (result.upsertedCount) await (await getCollection(COLLECTIONS.audit)).insertOne({
    actor: 'system:online-checkout', action: 'online-register', claimId: id, orderId: order.orderId,
    eligibleValue: gift.eligibleValue, giftCode: gift.giftCode, at: order.createdAt,
  }, { session })
}
