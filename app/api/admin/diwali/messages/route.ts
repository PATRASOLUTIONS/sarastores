import { requireUser } from '@/lib/auth'
import { json, body, requireSameOrigin, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
import { z } from 'zod'
import { listMessages, retryMessage } from '@/lib/diwali/messages'
const Retry = z.object({ id: z.string().uuid(), note: z.string().trim().min(3).max(500), confirmedNotSent: z.boolean() }).strict()
export async function GET() { try { const guard = await requireUser(); if (!guard.ok) return guard.response; return json({ items: await listMessages(guard.user) }) } catch (error) { return errorResponse(error) } }
export async function POST(request: Request) { try { requireSameOrigin(request); const guard = await requireUser(); if (!guard.ok) return guard.response; const input = await body(request, Retry); await retryMessage(guard.user, input.id, input.note, input.confirmedNotSent); return json({ queued: true }) } catch (error) { return errorResponse(error) } }
