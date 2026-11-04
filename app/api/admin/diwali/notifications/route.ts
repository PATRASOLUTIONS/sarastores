import { after } from 'next/server'
import { requireFullAdmin } from '@/lib/auth'
import { body, json, errorResponse, requireSameOrigin } from '@/lib/diwali/http'
import { NotificationSettingsSchema } from '@/lib/diwali/notification-types'
import { getRegistrationNotifications, saveRegistrationNotifications, processRegistrationEmails } from '@/lib/diwali/registration-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET() {
  try { const guard = await requireFullAdmin(); if (!guard.ok) return guard.response; return json(await getRegistrationNotifications()) }
  catch (error) { return errorResponse(error) }
}
export async function PUT(request: Request) {
  try {
    const guard = await requireFullAdmin(); if (!guard.ok) return guard.response
    requireSameOrigin(request)
    await saveRegistrationNotifications(guard.user.id, await body(request, NotificationSettingsSchema))
    return json({ saved: true })
  } catch (error) { return errorResponse(error) }
}
export async function POST(request: Request) {
  try {
    const guard = await requireFullAdmin(); if (!guard.ok) return guard.response
    requireSameOrigin(request)
    after(() => processRegistrationEmails().then(() => {}).catch(() => { console.error('[diwali] Registration email processing failed; review notification status.') }))
    return json({ scheduled: true }, 202)
  } catch (error) { return errorResponse(error) }
}
