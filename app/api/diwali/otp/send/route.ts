import { cookies } from 'next/headers'
import { body, json, errorResponse, requireSameOrigin, limit } from '@/lib/diwali/http'
import { OtpSendSchema } from '@/lib/diwali/schemas'
import { sendOtp } from '@/lib/diwali/service'
export async function POST(request: Request) {
  try { requireSameOrigin(request); await limit(request, 'otp-ip'); const input = await body(request, OtpSendSchema); await limit(request, 'otp-phone', input.mobile, 3); return json({ challenge: await sendOtp(input.mobile, input.language, input.purpose, input.email) }) } catch (error) { return errorResponse(error) }
}
