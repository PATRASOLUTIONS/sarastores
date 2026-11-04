import { requireUser } from '@/lib/auth'
import { json, body, requireSameOrigin, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
import { listClaims } from '@/lib/diwali/service'
export async function GET(request: Request) { try { const guard = await requireUser(); if (!guard.ok) return guard.response; return json(await listClaims(guard.user, new URL(request.url).searchParams)) } catch (error) { return errorResponse(error) } }
