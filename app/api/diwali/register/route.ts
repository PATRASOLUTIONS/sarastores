import { cookies } from 'next/headers'
import { after } from 'next/server'
import { body, json, errorResponse, requireSameOrigin, limit } from '@/lib/diwali/http'
import { RegistrationSchema } from '@/lib/diwali/schemas'
import { register } from '@/lib/diwali/service'
import { STORE_REFERRAL_COOKIE } from '@/lib/diwali/store-links'
import { processRegistrationEmails } from '@/lib/diwali/registration-notifications'
export const maxDuration = 60
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); await limit(request, 'registration', '', 30)
    const input = await body(request, RegistrationSchema)
    const result = await register((await cookies()).get('diwali_verified')?.value, input, (await cookies()).get(STORE_REFERRAL_COOKIE)?.value, (await cookies()).get('diwali_registration_check')?.value)
    after(() => processRegistrationEmails(result.reference).then(() => {}).catch(() => { console.error('[diwali] Registration email processing failed; review notification status.') }))
    return json(result, 201)
  } catch (error) { return errorResponse(error) }
}
