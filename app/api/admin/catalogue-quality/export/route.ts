import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireFullAdmin } from '@/lib/auth'
import { exportQualityWorkbook } from '@/lib/catalogue-quality-export'
import { QualityImportError } from '@/lib/catalogue-quality-import'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const exportSchema = z.object({ ids: z.array(z.string().min(1).max(100)).max(20000).optional() }).strict()
/** POST carries optional review-filter IDs; this operation is entirely read-only. */
export async function POST(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const parsed = exportSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid catalogue export selection' }, { status: 400, headers })
    const { bytes, total } = await exportQualityWorkbook(parsed.data.ids)
    return new NextResponse(new Uint8Array(bytes), { headers: {
      ...headers, 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="sara-catalogue-missing-data.xlsx"', 'X-Catalogue-Products': String(total),
    } })
  } catch (error) {
    if (error instanceof QualityImportError) return NextResponse.json({ error: error.message }, { status: error.status, headers })
    console.error('[Catalogue quality export] Failed', { name: error instanceof Error ? error.name : 'Unknown' })
    return NextResponse.json({ error: 'Could not download the catalogue Excel. Please try again.' }, { status: 500, headers })
  }
}
