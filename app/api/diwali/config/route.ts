import { publicConfig, getConfig } from '@/lib/diwali/service'
import { json, errorResponse } from '@/lib/diwali/http'
import { getSession } from '@/lib/auth'
import { isDiwaliCustomerBlocked } from '@/lib/diwali/blocklist'
export const dynamic = 'force-dynamic'
export async function GET() { try {
  const [config, session] = await Promise.all([getConfig(), getSession()])
  const customerAllowed = !session || !config.enabled || !await isDiwaliCustomerBlocked({ email: session.user.email, mobile: session.user.phone })
  return json({ ...publicConfig(config), customerAllowed })
} catch (error) { return errorResponse(error) } }
