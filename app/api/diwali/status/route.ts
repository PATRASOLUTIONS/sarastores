import { cookies } from 'next/headers'
import { customerClaims } from '@/lib/diwali/service'
import { json, errorResponse, limit } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) { try { await limit(request, 'status', '', 60); return json({ items: await customerClaims((await cookies()).get('diwali_verified')?.value) }) } catch (error) { return errorResponse(error) } }
