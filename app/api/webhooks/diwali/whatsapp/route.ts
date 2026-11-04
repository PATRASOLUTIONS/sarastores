import { createHmac, timingSafeEqual } from 'node:crypto'
import { recordProviderStatus } from '@/lib/diwali/messages'
import { json, errorResponse, DiwaliError } from '@/lib/diwali/http'
import { z } from 'zod'
const Payload = z.object({ entry: z.array(z.object({ changes: z.array(z.object({ value: z.object({ statuses: z.array(z.object({ id: z.string().max(300), status: z.enum(['sent', 'delivered', 'read', 'failed']), errors: z.array(z.object({ code: z.number().int() })).optional() })).max(100).optional() }) })).max(100) })).max(100) })
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams, token = process.env.DIWALI_WEBHOOK_VERIFY_TOKEN;
  if (!token || params.get('hub.mode') !== 'subscribe' || params.get('hub.verify_token') !== token) return json({ error: 'Unauthorized' }, 403);
  return new Response(params.get('hub.challenge') || '', { headers: { 'Content-Type': 'text/plain' } });
}
export async function POST(request: Request) {
  try { const secret = process.env.DIWALI_WEBHOOK_SECRET; if (!secret) throw new DiwaliError('Webhook is not configured', 503);
    const raw = await request.text(); if (raw.length > 100000) throw new DiwaliError('Payload too large', 413);
    const expected = Buffer.from('sha256=' + createHmac('sha256', secret).update(raw).digest('hex')), supplied = Buffer.from(request.headers.get('x-hub-signature-256') || '');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new DiwaliError('Invalid webhook signature', 401);
    const parsed = Payload.safeParse(JSON.parse(raw)); if (!parsed.success) throw new DiwaliError('Unsupported callback payload');
    for (const entry of parsed.data.entry) for (const change of entry.changes) for (const status of change.value.statuses || []) await recordProviderStatus(status.id, status.status, status.errors?.[0]?.code);
    return json({ received: true });
  } catch (error) { return errorResponse(error) }
}
