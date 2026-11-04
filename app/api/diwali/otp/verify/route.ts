import { cookies } from 'next/headers'
import { body, json, errorResponse, requireSameOrigin, limit } from '@/lib/diwali/http'
import { OtpVerifySchema } from '@/lib/diwali/schemas'
import { verifyOtp } from '@/lib/diwali/service'
export async function POST(request: Request) {
  try { requireSameOrigin(request); await limit(request, 'otp-verify', '', 30); const input = await body(request, OtpVerifySchema); const result = await verifyOtp(input.challenge, input.otp);
    if (!result.ok) return json({ error: 'Incorrect verification code' }, 401);
    const response = json({ verified: true }); response.cookies.set('diwali_verified', result.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/diwali', maxAge: 7200 }); return response;
  } catch (error) { return errorResponse(error) }
}
