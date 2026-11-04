import { cookies } from 'next/headers'
import { body, json, errorResponse, requireSameOrigin, limit } from '@/lib/diwali/http'
import { RegistrationSchema } from '@/lib/diwali/schemas'
import { register } from '@/lib/diwali/service'
import { STORE_REFERRAL_COOKIE } from '@/lib/diwali/store-links'
export async function POST(request: Request) {
  try { requireSameOrigin(request); await limit(request, 'registration', '', 30); const input = await body(request, RegistrationSchema); return json(await register((await cookies()).get('diwali_verified')?.value, input, (await cookies()).get(STORE_REFERRAL_COOKIE)?.value), 201) } catch (error) { return errorResponse(error) }
}
