import { after } from 'next/server'
import { requireUser } from '@/lib/auth'
import { authorize, getConfig } from '@/lib/diwali/service'
import { body, json, errorResponse, requireSameOrigin } from '@/lib/diwali/http'
import { NotificationSettingsSchema } from '@/lib/diwali/notification-types'
import { getRegistrationNotifications, saveRegistrationNotifications, processRegistrationEmails } from '@/lib/diwali/registration-notifications'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET() {
  try { const guard = await requireUser(); if (!guard.ok) return guard.response; authorize(guard.user, await getConfig(), 'settings'); return json(await getRegistrationNotifications()) }
  catch (error) { return errorResponse(error) }
}
export async function PUT(request: Request) {
  try {
    const guard = await requireUser(); if (!guard.ok) return guard.response
    authorize(guard.user, await getConfig(), 'settings')
    requireSameOrigin(request)
    await saveRegistrationNotifications(guard.user.id, await body(request, NotificationSettingsSchema))
    return json({ saved: true })
  } catch (error) { return errorResponse(error) }
}
export async function POST(request: Request) {
  try {
    const guard = await requireUser(); if (!guard.ok) return guard.response
    authorize(guard.user, await getConfig(), 'settings')
    requireSameOrigin(request)
    after(() => processRegistrationEmails().then(() => {}).catch(() => { console.error('[diwali] Registration email processing failed; review notification status.') }))
    return json({ scheduled: true }, 202)
  } catch (error) { return errorResponse(error) }
}
