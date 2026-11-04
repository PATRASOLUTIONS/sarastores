import { requireUser } from '@/lib/auth'
import { authorize, getConfig } from '@/lib/diwali/service'
import { campaignAccounts, campaignStoreDirectory } from '@/lib/diwali/store-links'
import { errorResponse, json } from '@/lib/diwali/http'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const guard = await requireUser(); if (!guard.ok) return guard.response
    const config = await getConfig(); authorize(guard.user, config, 'settings')
    const [stores, accounts] = await Promise.all([campaignStoreDirectory(), campaignAccounts(config, new URL(request.url).searchParams.get('search') || '')])
    return json({ stores, accounts })
  } catch (error) { return errorResponse(error) }
}
