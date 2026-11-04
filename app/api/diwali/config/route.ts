import { publicConfig, getConfig } from '@/lib/diwali/service'
import { json, errorResponse } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
export async function GET() { try { return json(publicConfig(await getConfig())) } catch (error) { return errorResponse(error) } }
