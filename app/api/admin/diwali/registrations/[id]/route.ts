import { requireUser, requireFullAdmin } from '@/lib/auth'
import { json, body, requireSameOrigin, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
import { getClaim, actOnClaim, deleteClaim } from '@/lib/diwali/service'
import { z } from 'zod'
import { ActionSchema } from '@/lib/diwali/schemas'
type Context = { params: Promise<{ id: string }> }
const DeleteSchema = z.object({ version: z.number().int().nonnegative() }).strict()
export async function GET(_request: Request, context: Context) { try { const guard = await requireUser(); if (!guard.ok) return guard.response; return json(await getClaim(guard.user, (await context.params).id)) } catch (error) { return errorResponse(error) } }
export async function POST(request: Request, context: Context) { try { requireSameOrigin(request); const guard = await requireUser(); if (!guard.ok) return guard.response; return json(await actOnClaim(guard.user, (await context.params).id, await body(request, ActionSchema))) } catch (error) { return errorResponse(error) } }
export async function DELETE(request: Request, context: Context) {
  try {
    requireSameOrigin(request)
    const guard = await requireFullAdmin()
    if (!guard.ok) return guard.response
    const input = await body(request, DeleteSchema)
    return json(await deleteClaim(guard.user, (await context.params).id, input.version))
  } catch (error) { return errorResponse(error) }
}
