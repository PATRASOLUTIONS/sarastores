import { requireUser } from '@/lib/auth'
import { json, body, requireSameOrigin, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
import { getClaim, actOnClaim } from '@/lib/diwali/service'
import { ActionSchema } from '@/lib/diwali/schemas'
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, context: Context) { try { const guard = await requireUser(); if (!guard.ok) return guard.response; return json(await getClaim(guard.user, (await context.params).id)) } catch (error) { return errorResponse(error) } }
export async function POST(request: Request, context: Context) { try { requireSameOrigin(request); const guard = await requireUser(); if (!guard.ok) return guard.response; return json(await actOnClaim(guard.user, (await context.params).id, await body(request, ActionSchema))) } catch (error) { return errorResponse(error) } }
