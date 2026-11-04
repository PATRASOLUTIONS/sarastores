'use client'

import { useState } from 'react'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { apiFetchJson } from '@/lib/api-client'

const ReportSchema = z.object({ status: z.enum(['disabled', 'busy', 'preview', 'success', 'pending', 'failed']), attempted: z.number(), accepted: z.number(), remaining: z.number(), message: z.string(), at: z.string() })
const StatusSchema = z.object({ enabled: z.boolean(), ready: z.boolean(), keyValid: z.boolean(), keyUrl: z.string().nullable(), origin: z.string().nullable(), problems: z.array(z.string()), lastRun: ReportSchema.nullable(), trackedUrls: z.number(), schedule: z.string() })
const load = (url: string) => apiFetchJson(url, {}, value => StatusSchema.parse(value))
const button = 'rounded-lg bg-[#1560BD] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'

export default function IndexNowSettings() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/indexnow', load, { refreshInterval: 60_000 })
  const [busy, setBusy] = useState(false), [result, setResult] = useState<z.infer<typeof ReportSchema> | null>(null)
  async function sync(dryRun: boolean) {
    setBusy(true); setResult(null)
    try {
      const report = await apiFetchJson(`/api/admin/indexnow${dryRun ? '?dryRun=1' : ''}`, { method: 'POST' }, value => ReportSchema.parse(value))
      setResult(report)
      if (report.status === 'pending') toast(report.message)
      else if (report.status === 'success' || report.status === 'preview') toast.success(dryRun ? 'Preview ready' : 'IndexNow sync completed')
      else toast(report.message)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'IndexNow sync failed') }
    finally { setBusy(false); void mutate() }
  }
  const report = result || data?.lastRun
  return <main className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
    <div><h1 className="text-2xl font-bold text-gray-900">IndexNow</h1><p className="mt-2 text-sm text-gray-600">Notify supporting search engines about public pages that are new, changed or removed. Google does not use IndexNow.</p></div>
    {isLoading ? <p role="status">Loading IndexNow status...</p> : error ? <div role="alert" className="rounded-lg border bg-red-50 p-4 text-red-800">Could not load IndexNow status. <button className="underline" onClick={() => void mutate()}>Retry</button></div> : data && <>
      <section className="space-y-4 rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{data.ready ? 'Ready to submit' : 'Setup required'}</h2><span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.ready ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>{data.enabled ? 'Enabled' : 'Disabled'}</span></div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-gray-500">Website</dt><dd className="mt-1 break-all font-medium">{data.origin || 'Not configured'}</dd></div><div><dt className="text-gray-500">Tracked public URLs</dt><dd className="mt-1 font-medium">{data.trackedUrls}</dd></div><div className="sm:col-span-2"><dt className="text-gray-500">Key verification file</dt><dd className="mt-1">{data.keyUrl ? <a href={data.keyUrl} target="_blank" rel="noopener noreferrer" className="break-all text-[#1560BD] underline">{data.keyUrl}</a> : 'Configure the website origin first'}</dd></div><div className="sm:col-span-2"><dt className="text-gray-500">Automatic schedule</dt><dd className="mt-1">{data.schedule}</dd></div></dl>
        {!!data.problems.length && <ul className="list-disc space-y-2 rounded-lg bg-amber-50 p-4 pl-8 text-sm text-amber-900">{data.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || !data.ready} onClick={() => void sync(true)}>Preview pending URLs</button><button className={button} disabled={busy || !data.ready} onClick={() => void sync(false)}>{busy ? 'Working...' : 'Sync now'}</button><button className="rounded-lg border px-4 py-2 text-sm font-semibold" disabled={busy} onClick={() => void mutate()}>Refresh status</button></div>
        <p className="text-xs text-gray-500">The first sync submits the public sitemap. Later syncs submit changes and removals. If URLs remain, use Sync now again; the daily job also resumes them.</p>
      </section>
      {report && <section aria-live="polite" className={`space-y-3 rounded-xl border p-5 ${report.status === 'failed' ? 'border-red-200 bg-red-50' : 'bg-gray-50'}`}><h2 className="font-semibold capitalize">Last result: {report.status}</h2><p className="text-sm">{report.message}</p><p className="text-sm text-gray-600">Attempted: {report.attempted} · Accepted: {report.accepted} · Remaining: {report.remaining}</p><p className="text-xs text-gray-500">{new Date(report.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p></section>}
      <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-semibold">Activate after deployment</h2><ol className="list-decimal space-y-2 pl-5 text-sm text-gray-600"><li>Add INDEXNOW_KEY and INDEXNOW_ENABLED=true to Vercel Production environment variables.</li><li>Set NEXT_PUBLIC_SITE_URL to your canonical public HTTPS website. Keep your existing CRON_SECRET configured for the daily job.</li><li>Deploy, then open the verification-file link above. It must show exactly your IndexNow key.</li><li>Use Preview pending URLs, then Sync now to submit the initial sitemap.</li></ol><p className="text-xs text-gray-500">Only public sitemap URLs are submitted. Customer, account, cart, checkout and private QR/token URLs are excluded. Accepted notifications do not guarantee indexing.</p></section>
    </>}
  </main>
}
