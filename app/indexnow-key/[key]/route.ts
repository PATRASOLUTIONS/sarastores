import { indexNowConfig } from '@/lib/indexnow/config'

export const dynamic = 'force-dynamic'
// /<INDEXNOW_KEY>.txt is rewritten here; only the configured filename can verify ownership.
export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key: requested } = await context.params
  const { key, keyValid } = indexNowConfig()
  const valid = keyValid && requested === key
  return new Response(valid ? key : 'Not found', { status: valid ? 200 : 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}
