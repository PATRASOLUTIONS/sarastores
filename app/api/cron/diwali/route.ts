import { type NextRequest } from 'next/server'
import { requireCron } from '@/lib/cron-auth'
import { processMessages } from '@/lib/diwali/messages'
import { json, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
export const maxDuration = 180
export async function GET(request: NextRequest) { const guard = requireCron(request); if (!guard.ok) return guard.response; try { return json(await processMessages()) } catch (error) { return errorResponse(error) } }
