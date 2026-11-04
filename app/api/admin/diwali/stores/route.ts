import { requireUser } from '@/lib/auth'
import { authorize, getConfig, scopeFilter } from '@/lib/diwali/service'
import { listStoreLinks } from '@/lib/diwali/store-links'
import { errorResponse, json } from '@/lib/diwali/http'
import { StoreHttpUrlSchema } from '@/lib/validation'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  try {
    const guard = await requireUser(); if (!guard.ok) return guard.response
    const config = await getConfig(), access = authorize(guard.user, config, 'view')
    const origin = StoreHttpUrlSchema.parse(process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin)
    return json({ stores: await listStoreLinks(config, access.stores, origin, scopeFilter(guard.user, config)) })
  } catch (error) { return errorResponse(error) }
}
