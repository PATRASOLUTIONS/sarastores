import { NextResponse } from 'next/server'
import { handleApiError } from '@/lib/api-error'
import { rateLimitHit } from '@/lib/rate-limit-store'
import { createHash } from 'node:crypto'
import type { z } from 'zod'

export class DiwaliError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export function errorResponse(error: unknown) {
  if (error instanceof DiwaliError) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return json({ error: 'This invoice already has a claim. No second gift can be allocated.' }, 409)
  return handleApiError(error, 'The gift service is temporarily unavailable. Please try again.')
}
export function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }) }
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new DiwaliError('Cross-site request denied', 403)
}
export async function body<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new DiwaliError('JSON body required', 415)
  const text = await request.text()
  if (text.length > 100000) throw new DiwaliError('Request too large', 413)
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new DiwaliError('Invalid JSON') }
  const parsed = schema.safeParse(value)
  if (!parsed.success) throw new DiwaliError(parsed.error.issues[0]?.message || 'Invalid input')
  return parsed.data
}
export async function limit(request: Request, purpose: string, identity = '', maximum = 10) {
  // Vercel's platform-set address is authoritative in production. Do not trust a client-supplied left-most XFF address.
  const address = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0] || 'unknown' : 'shared'
  const key = createHash('sha256').update(`${purpose}:${identity || address}`).digest('hex')
  if ((await rateLimitHit(`diwali:${key}`, maximum, 15 * 60_000)).limited) throw new DiwaliError('Too many attempts. Please try again later.', 429)
}
