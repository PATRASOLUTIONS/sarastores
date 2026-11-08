import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireFullAdmin } from '@/lib/auth'
import { applyQualityImport, previewQualityImport, QualityImportError, readQualityImport } from '@/lib/catalogue-quality-import'
import { QUALITY_IMPORT_MAX_BYTES } from '@/lib/catalogue-quality-sheet'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
const optionsSchema = z.object({ mode: z.enum(['preview', 'apply']), digest: z.string().max(64) })
export async function POST(request: Request) {
  const guard = await requireFullAdmin()
  if (!guard.ok) return guard.response
  const headers = { 'Cache-Control': 'no-store' }
  try {
    const declaredSize = Number(request.headers.get('content-length'))
    if (declaredSize > QUALITY_IMPORT_MAX_BYTES + 65536) throw new QualityImportError('Excel file must be 3 MB or smaller', 413)
    const form = await request.formData()
    const options = optionsSchema.safeParse({ mode: form.get('mode') || 'preview', digest: form.get('digest') || '' })
    if (!options.success) throw new QualityImportError('Invalid import options')
    const file = form.get('file')
    if (!(file instanceof File) || !/\.xlsx?$/i.test(file.name)) throw new QualityImportError('Upload an Excel .xlsx or .xls file')
    if (file.size > QUALITY_IMPORT_MAX_BYTES) throw new QualityImportError('Excel file must be 3 MB or smaller', 413)
    const rows = readQualityImport(Buffer.from(await file.arrayBuffer()))
    const result = options.data.mode === 'apply' ? await applyQualityImport(rows, options.data.digest) : await previewQualityImport(rows)
    return NextResponse.json(result, { headers })
  } catch (error) {
    if (error instanceof QualityImportError) return NextResponse.json({ error: error.message }, { status: error.status, headers })
    // Driver errors can contain record contents; return only a fixed message.
    console.error('[Catalogue quality import] Failed', { name: error instanceof Error ? error.name : 'Unknown' })
    return NextResponse.json({ error: 'Could not complete the upload. Saving requires MongoDB transactions; no partial import is applied. Please preview and try again.' }, { status: 500, headers })
  }
}
