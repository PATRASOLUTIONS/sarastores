/**
 * Repairs missing software fulfillment through the canonical paid-order path.
 * Usage: npx ts-node scripts/assign-missing-licenses.ts [daysBack]
 * This writes orders/license inventory and sends activation emails.
 */
import type { Filter } from 'mongodb'
import { z } from 'zod'
import { getCollection } from '../lib/db-service'
import type { OrderDocument } from '../lib/order-document'
import { fulfillSoftwareOrder, SoftwareFulfillmentError } from '../lib/software-fulfillment'

export const LicenseRepairDaysSchema = z.union([
  z.number(), z.string().regex(/^[1-9]\d*$/).transform(Number),
]).pipe(z.number().int().min(1).max(3650))
export interface ProcessingStats {
  totalOrders: number
  ordersProcessed: number
  licensesAssigned: number
  emailsSent: number
  ordersMarkedDelivered: number
  errors: Array<{ orderId: string; error: string }>
}

export function missingLicenseQuery(daysBack: number): Filter<OrderDocument> {
  const days = LicenseRepairDaysSchema.parse(daysBack)
  return {
    items: { $elemMatch: { type: 'software', provider: { $in: [null, ''] } } },
    'paymentVerification.verified': true,
    status: { $nin: ['cancelled', 'refunded', 'returned'] },
    licenseKey: { $in: [null, ''] },
    'licenseKeys.0': { $exists: false },
    $or: [
      { licenseFulfillment: { $exists: false } },
      { 'licenseFulfillment.status': { $in: ['needs_inventory', 'failed'] } },
    ],
    createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
  }
}

export async function assignMissingLicenses(daysBack = 30): Promise<ProcessingStats> {
  const query = missingLicenseQuery(daysBack)
  const orders = await getCollection<OrderDocument>('orders')
  const stats: ProcessingStats = {
    totalOrders: await orders.countDocuments(query), ordersProcessed: 0, licensesAssigned: 0,
    emailsSent: 0, ordersMarkedDelivered: 0, errors: [],
  }
  // Stream candidates; do not load the whole historical order collection.
  for await (const order of orders.find(query).sort({ createdAt: -1 })) {
    const orderId = order._id.toString()
    try {
      const result = await fulfillSoftwareOrder(orderId)
      stats.ordersProcessed++
      stats.licensesAssigned += result.licenseKeys.length
      stats.emailsSent += result.results.filter(email => email.sent).length
      if (result.results.some(email => !email.sent)) {
        stats.errors.push({ orderId, error: 'Activation email was not accepted; assigned keys remain on the order and must not be reassigned' })
      }
      const saved = await orders.findOne({ _id: order._id })
      if (!saved) throw new Error('Assigned order is missing')
      if (order.status !== 'delivered' && saved.status === 'delivered') stats.ordersMarkedDelivered++
    } catch (error) {
      console.error('[license-repair] Order fulfillment failed', { orderId, error })
      stats.errors.push({
        orderId,
        error: error instanceof SoftwareFulfillmentError ? error.message : 'Order fulfillment failed; review server logs before retrying',
      })
    }
  }
  return stats
}

async function main() {
  try {
    const daysBack = LicenseRepairDaysSchema.parse(process.argv[2] ?? 30)
    console.log(`Processing verified paid software orders from the last ${daysBack} days; activation emails will be sent`)
    const stats = await assignMissingLicenses(daysBack)
    console.log(JSON.stringify(stats, null, 2))
    process.exitCode = stats.errors.length ? 1 : 0
  } catch (error) {
    console.error('[license-repair] Failed:', error)
    process.exitCode = 1
  }
}

if (require.main === module) void main()
