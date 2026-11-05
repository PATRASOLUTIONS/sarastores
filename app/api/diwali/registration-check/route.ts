import { body, json, errorResponse, requireSameOrigin, limit } from '@/lib/diwali/http'
import { checkRegistrationDetails } from '@/lib/diwali/service'
import { RegistrationCheckSchema, REGISTRATION_CHECK_COOKIE, REGISTRATION_CHECK_MAX_AGE } from '@/lib/diwali/registration-check'

export async function POST(request: Request) {
  try {
    requireSameOrigin(request)
    await limit(request, 'registration-check', '', 30)
    const input = await body(request, RegistrationCheckSchema)
    await limit(request, 'registration-check-mobile', input.mobile, 10)
    if (input.email) await limit(request, 'registration-check-email', input.email, 10)
    const token = await checkRegistrationDetails(input)
    const response = json({ available: true })
    response.cookies.set(REGISTRATION_CHECK_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/diwali/register', maxAge: REGISTRATION_CHECK_MAX_AGE })
    return response
  } catch (error) { return errorResponse(error) }
}
