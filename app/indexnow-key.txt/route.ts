import { indexNowConfig } from '@/lib/indexnow/config'

export const dynamic = 'force-dynamic'
export function GET() {
  const { key, keyValid } = indexNowConfig()
  return new Response(keyValid ? key : 'IndexNow key is not configured.', { status: keyValid ? 200 : 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}
