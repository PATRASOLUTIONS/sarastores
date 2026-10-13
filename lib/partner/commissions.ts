import { ObjectId } from 'mongodb'
import { z } from 'zod'
import { getCollection } from '@/lib/db-service'
import { connectToDatabase } from '@/lib/mongodb'
import type { PartnerOrder } from './types'

export const CommissionPaymentSchema = z.object({
  partnerId: z.string().trim().min(1).max(100),
  orderIds: z.array(z.string().trim().min(1).max(100)).min(1).max(200),
  transactionId: z.string().trim().min(1).max(200).nullish(),
  notes: z.string().trim().max(2000).nullish(),
  totalAmount: z.number().finite().nonnegative().max(100000000).optional(),
}).strict().refine(value => new Set(value.orderIds).size === value.orderIds.length,
  { message: 'Duplicate order selections are not allowed' })

export class CommissionPaymentError extends Error {
  constructor(message: string, public readonly status = 409) { super(message) }
}

export interface DirectCommissionPayout {
  partnerId: string
  amount: number
  status: 'completed'
  source: 'admin_direct'
  orderIds: string[]
  transactionId?: string
  notes?: string
  adminNotes: string
  approvedBy: string
  requestedAt: Date
  approvedAt: Date
  completedAt: Date
  createdAt: Date
  updatedAt: Date
}

export function isCommissionPaymentEligible(order: Pick<PartnerOrder, 'commission' | 'paymentVerification'>): boolean {
  return order.commission?.status === 'pending' && order.paymentVerification?.verified === true
}

export async function recordCommissionPayment(input: z.infer<typeof CommissionPaymentSchema>, operatorId: string) {
  if (!operatorId) throw new Error('Authenticated operator identity is missing')
  const { client } = await connectToDatabase()
  const session = client.startSession()
  try {
    const result = await session.withTransaction(async () => {
      const orders = await getCollection<PartnerOrder>('partner_orders')
      const payouts = await getCollection<DirectCommissionPayout>('partner_payouts')
      const selected = []
      const selectedIds = new Set<string>()
      let totalCents = 0
      for (const id of input.orderIds) {
        // Preserve internal-order-ID precedence without masking database failures.
        let candidates = await orders.find({ partnerId: input.partnerId, orderId: id }, { session }).limit(2).toArray()
        if (!candidates.length && ObjectId.isValid(id)) {
          candidates = await orders.find({ partnerId: input.partnerId, _id: new ObjectId(id) }, { session }).limit(2).toArray()
        }
        if (candidates.length !== 1) throw new CommissionPaymentError('An order is missing or ambiguous; no commissions were changed')
        const order = candidates[0]
        if (!isCommissionPaymentEligible(order)) {
          throw new CommissionPaymentError('Only pending commissions on paid orders with a verified payment are eligible')
        }
        if (selectedIds.has(order._id.toString())) throw new CommissionPaymentError('The same order was selected twice', 400)
        selectedIds.add(order._id.toString())
        const amount = order.commission.amount
        const cents = Math.round(amount * 100)
        if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(cents) || Math.abs(amount * 100 - cents) > 0.000001) {
          throw new CommissionPaymentError('A stored commission amount is invalid; no commissions were changed')
        }
        totalCents += cents
        selected.push(order)
      }
      if (!Number.isSafeInteger(totalCents) || totalCents <= 0) throw new CommissionPaymentError('Commission total must be a positive valid amount')
      if (input.totalAmount !== undefined && Math.abs(input.totalAmount * 100 - totalCents) > 0.000001) {
        throw new CommissionPaymentError('Commission amounts changed; refresh the selection before recording payment')
      }
      const now = new Date()
      const payoutId = new ObjectId()
      for (const order of selected) {
        const updated = await orders.updateOne({
          _id: order._id, partnerId: input.partnerId, 'commission.status': 'pending',
          'commission.amount': order.commission.amount, 'paymentVerification.verified': true,
        }, { $set: {
          'commission.status': 'credited', 'commission.creditedAt': now,
          'commission.creditedBy': operatorId, 'commission.payoutId': payoutId.toString(),
          'commission.transactionId': input.transactionId ?? null, updatedAt: now,
        } }, { session })
        if (updated.modifiedCount !== 1) throw new CommissionPaymentError('Commission payment conflicted with another update; refresh the selection')
      }
      await payouts.insertOne({
        _id: payoutId, partnerId: input.partnerId, amount: totalCents / 100,
        status: 'completed', source: 'admin_direct', orderIds: [...selectedIds],
        ...(input.transactionId ? { transactionId: input.transactionId } : {}),
        ...(input.notes ? { notes: input.notes } : {}),
        adminNotes: `Operator recorded an external commission payment for ${selected.length} order(s); no wallet credit or bank transfer initiated`,
        approvedBy: operatorId, requestedAt: now, approvedAt: now, completedAt: now, createdAt: now, updatedAt: now,
      }, { session })
      return {
        updated: selected.length, orderIds: [...selectedIds], amount: totalCents / 100,
        payoutId: payoutId.toString(), failed: 0, failedIds: [],
      }
    })
    if (!result) throw new Error('Commission payment transaction did not commit')
    return result
  } finally {
    await session.endSession()
  }
}
