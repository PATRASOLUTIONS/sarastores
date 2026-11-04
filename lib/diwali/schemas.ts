import { z } from 'zod'
import { phoneSchema, pincodeSchema } from '@/lib/validation'
import { isRealDate } from './rules'

export const Language = z.enum(['en', 'kn'])
export const DateOnly = z.string().refine(isRealDate, 'Enter a valid date')
export const Role = z.enum(['verifier', 'fulfilment', 'management'])
export const ConfigSchema = z.object({
  enabled: z.boolean(),
  rulesConfirmed: z.boolean(),
  calendarConfirmed: z.boolean(),
  campaignStart: DateOnly,
  campaignEnd: DateOnly,
  registrationStart: DateOnly,
  registrationEnd: DateOnly,
  workingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  holidays: z.array(DateOnly).max(100),
  termsEn: z.string().max(20000), termsKn: z.string().max(20000),
  privacyEn: z.string().max(20000), privacyKn: z.string().max(20000),
  consentVersion: z.string().trim().min(1).max(100),
  stores: z.array(z.object({ code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(150) }).strict()).max(300),
  staff: z.array(z.object({ userId: z.string().min(1).max(100), role: Role, export: z.boolean(), stores: z.array(z.string().max(40)).max(300) }).strict()).max(200),
}).strict().superRefine((config, ctx) => {
  if (config.campaignStart > config.campaignEnd || config.registrationStart > config.registrationEnd) ctx.addIssue({ code: 'custom', message: 'Start date must precede closing date' })
  if (new Set(config.stores.map(store => store.code)).size !== config.stores.length) ctx.addIssue({ code: 'custom', message: 'Store codes must be unique' })
  if (new Set(config.staff.map(staff => staff.userId)).size !== config.staff.length) ctx.addIssue({ code: 'custom', message: 'Staff assignments must be unique' })
  if (config.staff.some(staff => staff.stores.some(code => !config.stores.some(store => store.code === code)))) ctx.addIssue({ code: 'custom', message: 'Staff store restrictions must use the store master' })
  if (config.enabled && (!config.rulesConfirmed || !config.calendarConfirmed || !config.stores.length || !config.termsEn.trim() || !config.termsKn.trim() || !config.privacyEn.trim() || !config.privacyKn.trim())) ctx.addIssue({ code: 'custom', message: 'Confirm rules/calendar and supply stores and bilingual legal copy before opening registration' })
})
export type CampaignConfig = z.infer<typeof ConfigSchema>
export const DEFAULT_CONFIG: CampaignConfig = {
  enabled: false, rulesConfirmed: false, calendarConfirmed: false,
  campaignStart: '2026-11-05', campaignEnd: '2026-11-12', registrationStart: '2026-11-05', registrationEnd: '2026-11-12',
  workingDays: [1, 2, 3, 4, 5], holidays: [], termsEn: '', termsKn: '', privacyEn: '', privacyKn: '',
  consentVersion: 'diwali-2026-v1', stores: [], staff: [],
}
export const OtpSendSchema = z.object({ mobile: phoneSchema, language: Language, purpose: z.enum(['register', 'status']).default('register') }).strict()
export const OtpVerifySchema = z.object({ challenge: z.string().uuid(), otp: z.string().regex(/^\d{6}$/) }).strict()
export const RegistrationSchema = z.object({
  requestId: z.string().uuid(), name: z.string().trim().min(2).max(150),
  address: z.string().trim().min(10).max(800), city: z.string().trim().min(2).max(100), district: z.string().trim().min(2).max(100),
  pincode: pincodeSchema, storeCode: z.string().trim().min(1).max(40), invoice: z.string().trim().min(1).max(100),
  enteredValue: z.number().int().min(15000).max(100000000), language: Language,
  accuracy: z.literal(true), whatsappConsent: z.boolean(), consentVersion: z.string().max(100),
}).strict()
export const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('correct'), version: z.number().int().nonnegative(), invoice: z.string().trim().min(1).max(100), storeCode: z.string().trim().min(1).max(40), note: z.string().trim().min(3).max(1000) }).strict(),
  z.object({ action: z.literal('approve'), version: z.number().int().nonnegative(), verifiedValue: z.number().int().min(15000).max(100000000), invoiceDate: DateOnly, storeCode: z.string().min(1).max(40), note: z.string().trim().min(3).max(1000), invoiceValid: z.literal(true), notRefunded: z.literal(true) }).strict(),
  z.object({ action: z.literal('reject'), version: z.number().int().nonnegative(), note: z.string().trim().min(3).max(1000) }).strict(),
  z.object({ action: z.literal('pack'), version: z.number().int().nonnegative(), note: z.string().trim().max(1000).default('') }).strict(),
  z.object({ action: z.literal('dispatch'), version: z.number().int().nonnegative(), courier: z.string().trim().min(2).max(100), awb: z.string().trim().min(2).max(100), trackingUrl: z.union([z.literal(''), z.string().url().max(500).refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS tracking URL')]) }).strict(),
  z.object({ action: z.literal('deliver'), version: z.number().int().nonnegative(), proof: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal('exception'), version: z.number().int().nonnegative(), note: z.string().trim().min(3).max(1000), nextAction: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal('resume'), version: z.number().int().nonnegative(), note: z.string().trim().min(3).max(1000) }).strict(),
])
export type ClaimAction = z.infer<typeof ActionSchema>
export const StockSchema = z.object({ giftCode: z.enum(['silver5', 'silver10', 'silver15', 'silver20', 'gold1']), quantity: z.number().int().min(1).max(100000), note: z.string().trim().max(500).default('') }).strict()
