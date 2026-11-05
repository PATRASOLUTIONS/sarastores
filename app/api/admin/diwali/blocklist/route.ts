import { requireUser } from '@/lib/auth'
import { authorize, getConfig } from '@/lib/diwali/service'
import { addDiwaliBlocklist, listDiwaliBlocklist, updateDiwaliBlocklist } from '@/lib/diwali/blocklist'
import { BlocklistInputSchema, BlocklistUpdateSchema } from '@/lib/diwali/blocklist-types'
import { body, errorResponse, json, requireSameOrigin } from '@/lib/diwali/http'

export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const guard = await requireUser(); if (!guard.ok) return guard.response
    authorize(guard.user, await getConfig(), 'settings')
    return json(await listDiwaliBlocklist(new URL(request.url).searchParams))
  } catch (error) { return errorResponse(error) }
}
export async function POST(request: Request) {
  try {
    const guard = await requireUser(); if (!guard.ok) return guard.response
    authorize(guard.user, await getConfig(), 'settings')
    requireSameOrigin(request)
    return json({ entry: await addDiwaliBlocklist(guard.user.id, await body(request, BlocklistInputSchema)) }, 201)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return json({ error: 'These details are already on the blocklist. Refresh and try again.' }, 409)
    return errorResponse(error)
  }
}
export async function PUT(request: Request) {
  try {
    const guard = await requireUser(); if (!guard.ok) return guard.response
    authorize(guard.user, await getConfig(), 'settings')
    requireSameOrigin(request)
    return json(await updateDiwaliBlocklist(guard.user.id, await body(request, BlocklistUpdateSchema)))
  } catch (error) { return errorResponse(error) }
}
