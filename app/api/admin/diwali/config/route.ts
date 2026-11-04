import { requireUser } from '@/lib/auth'
import { json, body, requireSameOrigin, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
import { getConfig, accessFor, saveConfig } from '@/lib/diwali/service'
import { ConfigSchema } from '@/lib/diwali/schemas'
export async function GET() { try { const guard = await requireUser(); if (!guard.ok) return guard.response; const config = await getConfig(); const access = accessFor(guard.user, config); return json({ config: access.role === 'superadmin' ? config : { stores: config.stores }, access }) } catch (error) { return errorResponse(error) } }
export async function PUT(request: Request) { try { requireSameOrigin(request); const guard = await requireUser(); if (!guard.ok) return guard.response; await saveConfig(guard.user, await body(request, ConfigSchema)); return json({ saved: true }) } catch (error) { return errorResponse(error) } }
