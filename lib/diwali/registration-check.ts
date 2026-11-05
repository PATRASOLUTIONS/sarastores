import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { phoneSchema } from '@/lib/validation'
import { OptionalDiwaliEmailSchema } from './blocklist-types'
import { DiwaliError } from './http'

export const REGISTRATION_CHECK_COOKIE = 'diwali_registration_check'
export const REGISTRATION_CHECK_MAX_AGE = 30 * 60
export const RegistrationCheckSchema = z.object({ mobile: phoneSchema, email: OptionalDiwaliEmailSchema }).strict()
const ReceiptSchema = RegistrationCheckSchema.extend({ purpose: z.literal('registration-availability'), checkedAt: z.number().int(), expiresAt: z.number().int() }).strict()

function signature(payload: string) {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 16) throw new DiwaliError('Registration verification is not configured', 503)
  return createHmac('sha256', secret).update(payload).digest()
}

/** Availability is only permission to submit this identity, never to read customer records. */
export function createRegistrationCheck(input: z.infer<typeof RegistrationCheckSchema>) {
  const checkedAt = Date.now()
  const payload = Buffer.from(JSON.stringify({ ...input, purpose: 'registration-availability', checkedAt, expiresAt: checkedAt + REGISTRATION_CHECK_MAX_AGE * 1000 })).toString('base64url')
  return `${payload}.${signature(payload).toString('base64url')}`
}

export function readRegistrationCheck(token: string, mobile: string | undefined, email = '') {
  const failure = () => new DiwaliError('Verify your details again before submitting registration.', 401)
  if (token.length > 2000) throw failure()
  const [payload, supplied, extra] = token.split('.')
  if (!payload || !supplied || extra || !/^[A-Za-z0-9_-]+$/.test(supplied)) throw failure()
  const expected = signature(payload), actual = Buffer.from(supplied, 'base64url')
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw failure()
  let value: unknown
  try { value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { throw failure() }
  const receipt = ReceiptSchema.safeParse(value)
  if (!receipt.success || receipt.data.expiresAt <= Date.now() || receipt.data.mobile !== mobile || receipt.data.email !== email.trim().toLowerCase()) throw failure()
  return { mobile: receipt.data.mobile, checkedAt: new Date(receipt.data.checkedAt), verifiedAt: undefined }
}
