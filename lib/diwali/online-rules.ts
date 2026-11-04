import { z } from 'zod'
import { giftForRupees, indiaDate } from './rules'

export const ONLINE_STORE = 'ONLINE'
export const OnlineGiftSchema = z.object({
  giftCode: z.enum(['silver5', 'silver10', 'silver15', 'silver20', 'gold1']),
  label: z.string(), kannada: z.string(), eligibleValue: z.number().int().min(15000),
  consentVersion: z.string(),
})
export type OnlineGift = z.infer<typeof OnlineGiftSchema>
type Campaign = { enabled: boolean; campaignStart: string; campaignEnd: string; registrationStart: string; registrationEnd: string; consentVersion: string }
export function onlineCampaignOpen(config: Campaign, at = new Date()) {
  const today = indiaDate(at)
  return config.enabled && today >= config.campaignStart && today <= config.campaignEnd
    && today >= config.registrationStart && today <= config.registrationEnd
}
export function onlineGift(config: Campaign, total: number, shipping: number, at = new Date()): OnlineGift | null {
  if (!onlineCampaignOpen(config, at) || !Number.isFinite(total) || !Number.isFinite(shipping) || shipping < 0) return null
  const eligibleValue = Math.round((total - shipping) * 100) / 100
  const gift = giftForRupees(eligibleValue)
  return gift ? { giftCode: gift.code, label: gift.label, kannada: gift.kannada, eligibleValue, consentVersion: config.consentVersion } : null
}
export type OnlineOrderState = { status?: string; paymentVerification?: { verified?: boolean }; paymentMethod?: string; total?: number; shipping?: number }
export function onlineOrderPaymentState(order: OnlineOrderState | null) {
  if (!order) return 'Order unavailable'
  if (/cancel|refund|fail|review|return/i.test(order.status || '')) return `Blocked: ${order.status}`
  if (order.paymentVerification?.verified === true) return 'Payment confirmed'
  if (['cash', 'cod', 'cash-on-delivery'].includes(order.paymentMethod || '') && order.status === 'delivered') return 'Payment confirmed'
  return 'Awaiting payment confirmation'
}
export function onlineOrderGiftError(order: OnlineOrderState | null, eligibleValue: number) {
  const paymentState = onlineOrderPaymentState(order)
  if (paymentState !== 'Payment confirmed') return paymentState
  if (Math.round(((order?.total ?? NaN) - (order?.shipping ?? NaN)) * 100) !== Math.round(eligibleValue * 100)) return 'Order value changed; resolve the order before allocating its gift'
  return null
}
