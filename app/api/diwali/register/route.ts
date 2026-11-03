import { cookies } from 'next/headers'
import { body, json, errorResponse, requireSameOrigin, limit } from '@/lib/diwali/http'
import { RegistrationSchema } from '@/lib/diwali/schemas'
import { register } from '@/lib/diwali/service'
export async function POST(request: Request) {
  try { requireSameOrigin(request); await limit(request, 'registration', '', 30); const input = await body(request, RegistrationSchema); return json(await register((await cookies()).get('diwali_verified')?.value, input), 201) } catch (error) { return errorResponse(error) }
}
