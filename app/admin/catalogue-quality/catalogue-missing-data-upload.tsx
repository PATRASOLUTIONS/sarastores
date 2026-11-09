"use client"

import { useState } from 'react'
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiFetch } from '@/lib/api-client'
import { QUALITY_IMPORT_MAX_BYTES, type QualityImportPreview } from '@/lib/catalogue-quality-sheet'
import type { QualityProduct } from '@/lib/catalogue-quality'

export default function CatalogueMissingDataUpload({ products, onSaved, disabled = false }: {
  products?: QualityProduct[]; onSaved: () => void; disabled?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<QualityImportPreview | null>(null)
  const [busy, setBusy] = useState<'preview' | 'apply' | 'download' | null>(null)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [confirmed, setConfirmed] = useState(false)
  const [saved, setSaved] = useState('')
  const download = async () => {
    setBusy('download'); setError('')
    try {
      const response = await apiFetch('/api/admin/catalogue-quality/export', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(products ? { ids: products.map(product => product.id) } : {}) })
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Could not download the catalogue') }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a')
      link.href = url; link.download = 'sara-catalogue-missing-data.xlsx'; document.body.appendChild(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not download the template') }
    finally { setBusy(null) }
  }
  const submit = async (mode: 'preview' | 'apply') => {
    if (!file || busy || disabled || mode === 'apply' && (!preview?.canApply || !confirmed)) return
    setBusy(mode); setError(''); setSaved('')
    try {
      const form = new FormData(); form.set('file', file); form.set('mode', mode)
      if (mode === 'apply' && preview) form.set('digest', preview.digest)
      const response = await apiFetch('/api/admin/catalogue-quality/import', { method: 'POST', body: form })
      const data = await response.json()
      if (!response.ok) {
        if (mode === 'apply') { setPreview(null); setConfirmed(false) }
        throw new Error(data.error || 'Upload failed')
      }
      if (mode === 'preview') { setPreview(data); setPage(1); setConfirmed(false) }
      else {
        const message = `Filled missing data for ${data.saved} products.`
        setSaved(message); toast.success(message); setPreview(null); setConfirmed(false); onSaved()
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed') }
    finally { setBusy(null) }
  }
  const pages = Math.max(1, Math.ceil((preview?.rows.length || 0) / 20))
  return <section className="rounded-xl border border-blue-200 bg-white p-5" aria-labelledby="missing-data-upload-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="missing-data-upload-title" className="flex items-center gap-2 text-lg font-bold text-gray-900"><FileSpreadsheet className="h-5 w-5 text-blue-800" />Fill missing data from Excel</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">Upload itemno, name, classification, descriptions, identifiers, images, warranty, tax and missing price / stock values. Existing values are preserved. Preview every change before saving.</p></div>
      <button type="button" onClick={() => void download()} disabled={Boolean(busy) || disabled} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"><Download className="h-4 w-4" />{busy === 'download' ? 'Preparing Excel…' : products ? 'Download filtered catalogue Excel' : 'Download Excel template'}</button>
    </div>
    <p className="mt-3 text-xs text-gray-500">The download includes current itemno, name and all available supported fields. Before scanning, it includes the entire catalogue; after scanning, it follows the review filters. Fill the blanks and remove rows you are not correcting before uploading. Maximum 500 upload rows / 3 MB, first worksheet only.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="block text-sm font-medium text-gray-700">Excel file<input type="file" accept=".xlsx,.xls" disabled={Boolean(busy) || disabled} className="mt-1 block max-w-full text-sm file:mr-3 file:rounded-lg file:border file:bg-white file:px-3 file:py-2" onChange={event => {
        const selected = event.target.files?.[0] || null
        setPreview(null); setConfirmed(false); setSaved(''); setError(''); setFile(null)
        if (selected && selected.size > QUALITY_IMPORT_MAX_BYTES) { setError('Excel file must be 3 MB or smaller'); event.target.value = ''; return }
        setFile(selected)
      }} /></label>
      <button type="button" onClick={() => void submit('preview')} disabled={!file || Boolean(busy) || disabled} className="inline-flex items-center gap-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Preview upload</button>
    </div>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {saved && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-900">{saved} Rescan the catalogue to see the remaining issues.</p>}
    {preview && <div className="mt-5 space-y-4">
      <p className="text-sm font-semibold">{preview.summary.products} products to update · {preview.summary.fields} field changes · {preview.summary.errors} row errors</p>
      <p className="text-xs text-gray-600">Existing classification may be mapped to the current hierarchy while retaining its meaning; these mapping changes are also listed below. No changes are saved if any row has an error.</p>
      <div className="max-h-[32rem] space-y-3 overflow-y-auto">{preview.rows.slice((page - 1) * 20, page * 20).map(row => <article key={row.row} className={`rounded-lg border p-3 text-sm ${row.error ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
        <p className="font-semibold">Excel row {row.row}: {row.itemno || row.productId || 'Missing identity'} · {row.name}</p>
        {row.error ? <p className="mt-2 text-red-800">{row.error}</p> : <>
          {row.changes.length ? <ul className="mt-2 space-y-1">{row.changes.map(change => <li key={change.field} className="break-words"><strong>{change.field}:</strong> {change.before || 'Missing'} → {change.after}</li>)}</ul> : <p className="mt-2 text-gray-500">No missing fields to fill in this row.</p>}
          {row.preserved.length > 0 && <p className="mt-2 text-xs text-gray-500">Preserved existing values: {row.preserved.join(', ')}</p>}
        </>}
      </article>)}</div>
      {pages > 1 && <div className="flex items-center gap-3 text-sm"><button type="button" disabled={page === 1 || Boolean(busy)} onClick={() => setPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page === pages || Boolean(busy)} onClick={() => setPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button></div>}
      {preview.canApply && <div className="space-y-3 border-t pt-4"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={Boolean(busy) || disabled} onChange={event => setConfirmed(event.target.checked)} className="mt-1" /><span>I reviewed these changes and approve saving the missing data to these products.</span></label>
        <button type="button" onClick={() => void submit('apply')} disabled={!confirmed || Boolean(busy) || disabled} className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy === 'apply' && <Loader2 className="h-4 w-4 animate-spin" />}Save missing data</button></div>}
      {!preview.canApply && <p className="text-sm text-gray-600">{preview.summary.errors ? 'Correct the errors in Excel, then upload and preview again.' : 'No missing values can be filled from this file.'}</p>}
    </div>}
  </section>
}
