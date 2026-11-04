import { z } from 'zod'
import { emailSchema } from '@/lib/validation'

export function normalizeBlocklistMobile(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[\d\s()+-]+$/.test(value)) return null
  let digits = value.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}
export const DiwaliEmailSchema = z.string().trim().toLowerCase().pipe(emailSchema)
export const BlocklistInputSchema = z.object({
  email: z.union([z.literal(''), DiwaliEmailSchema]).default(''),
  mobile: z.string().trim().max(40).refine(value => !value || !!normalizeBlocklistMobile(value), 'Enter a valid Indian mobile number.')
    .transform(value => value ? normalizeBlocklistMobile(value)! : '').default(''),
  reason: z.string().trim().min(3, 'Enter a reason with at least three characters.').max(500),
}).strict().superRefine((value, context) => {
  if (!value.email && !value.mobile) context.addIssue({ code: 'custom', path: ['email'], message: 'Enter an email address, a mobile number, or both.' })
})
export const BlocklistUpdateSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{64}$/), active: z.boolean(), version: z.number().int().min(1),
}).strict()
export type BlocklistInput = z.infer<typeof BlocklistInputSchema>
export type BlocklistUpdate = z.infer<typeof BlocklistUpdateSchema>
export type DiwaliBlocklistEntry = {
  id: string; email: string; mobile: string; reason: string; active: boolean;
  createdAt: string; updatedAt: string; createdBy: string; updatedBy: string; version: number;
}
