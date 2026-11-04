import { createHash, randomUUID } from 'node:crypto'
import type { Document } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import sitemap from '@/app/sitemap'
import { STATIC_SITEMAP_PATHS } from '@/lib/sitemap-paths'
import { INDEXNOW_ENDPOINT, indexNowConfig } from './config'

type State = Document & { _id: string; url?: string; fingerprint?: string }
export type IndexNowReport = { status: 'disabled' | 'busy' | 'preview' | 'success' | 'pending' | 'failed'; attempted: number; accepted: number; remaining: number; message: string; at: string }
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const headers = { 'Content-Type': 'application/json; charset=utf-8' }
export function publicIndexNowUrl(value: string, origin: string): string | null {
  try {
    const url = new URL(value)
    if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.href.length > 2048) return null
    const path = url.pathname
    if (!STATIC_SITEMAP_PATHS.includes(path) && !/^\/(?:product|category|sub-category|brands|stores|campaign|blog)\/[^/]+(?:\/[^/]+)?$/.test(path)) return null
    if (/%(?:00|0a|0d|5c)/i.test(path)) return null
    return url.href
  } catch { return null }
}

export function indexNowChanges(current: Map<string, string>, previous: Array<{ url?: string; fingerprint?: string }>, origin: string) {
  const prior = new Map(previous.filter(row => row.url && publicIndexNowUrl(row.url, origin)).map(row => [row.url!, row.fingerprint]))
  const changed = [...current].filter(([url, fingerprint]) => prior.get(url) !== fingerprint).map(([url, fingerprint]) => ({ url, fingerprint, removed: false }))
  const removed = [...prior.keys()].filter(url => !current.has(url)).map(url => ({ url, fingerprint: '', removed: true }))
  return [...removed, ...changed]
}

async function currentManifest(origin: string) {
  // A failed sitemap source aborts the job: a DB outage must never look like page deletion.
  const entries = await sitemap()
  if (!entries.length) throw new Error('Sitemap is empty; no deletion notifications were sent.')
  const collection = await getCollection('settings')
  const settings = await collection.find({}, { projection: { updatedAt: 1 } }).toArray()
  const revision = `${process.env.VERCEL_GIT_COMMIT_SHA || ''}:${settings.map(row => String(row.updatedAt || '')).sort().join('|')}`
  const current = new Map<string, string>()
  for (const entry of entries) {
    const url = publicIndexNowUrl(entry.url, origin)
    if (!url) throw new Error('Sitemap contains a URL outside the configured public website. Check the website origin.')
    const modified = entry.lastModified ? new Date(entry.lastModified).toISOString() : ''
    current.set(url, hash(JSON.stringify([modified, revision, entry.images || []])))
  }
  const listingRevision = hash([...current].sort(([a], [b]) => a.localeCompare(b)).map(([url, fingerprint]) => `${url}:${fingerprint}`).join('|'))
  // Root and static listing pages change when their published catalogue changes.
  for (const [url, fingerprint] of current) if (STATIC_SITEMAP_PATHS.includes(new URL(url).pathname)) current.set(url, hash(`${fingerprint}:${listingRevision}`))
  return current
}

export async function indexNowStatus() {
  const config = indexNowConfig()
  const state = await getCollection<State>('indexnow_state')
  const latest = await state.findOne({ _id: 'report' })
  return { enabled: config.enabled, ready: config.ready, keyValid: config.keyValid, keyUrl: config.keyUrl,
    origin: config.origin || null, problems: config.problems, lastRun: latest?.report || null,
    trackedUrls: await state.countDocuments({ url: { $exists: true } }), schedule: 'Daily at 01:00 UTC / 06:30 IST, through the existing maintenance cron.' }
}

export async function runIndexNow({ dryRun = false, maxBatches = 5, budgetMs = 45_000 }: { dryRun?: boolean; maxBatches?: number; budgetMs?: number } = {}): Promise<IndexNowReport> {
  const started = Date.now(), config = indexNowConfig()
  const report: IndexNowReport = { status: 'disabled', attempted: 0, accepted: 0, remaining: 0, message: config.problems.join(' '), at: new Date().toISOString() }
  if (!config.ready || !config.origin || !config.keyUrl) return report
  const origin = config.origin, keyUrl = config.keyUrl
  const state = await getCollection<State>('indexnow_state')
  const owner = randomUUID()
  let leased = false
  if (!dryRun) {
    try {
      const result = await state.updateOne({ _id: 'runner', $or: [{ leaseUntil: { $lte: new Date() } }, { leaseUntil: { $exists: false } }] },
        { $set: { owner, leaseUntil: new Date(Date.now() + 120_000) } }, { upsert: true })
      leased = !!(result.modifiedCount || result.upsertedCount)
    } catch (error) { if ((error as { code?: number }).code !== 11000) throw error }
    if (!leased) return { ...report, status: 'busy', message: 'Another IndexNow submission is running. Try again shortly.' }
  }
  try {
    const manifest = await currentManifest(origin)
    const previous = await state.find({ url: { $exists: true } }, { projection: { url: 1, fingerprint: 1 } }).toArray()
    const changes = indexNowChanges(manifest, previous, origin)
    report.remaining = changes.length
    if (dryRun) return { ...report, status: 'preview', message: `${changes.length} new, changed or removed public URLs would be submitted. No writes or network submissions performed.` }
    report.status = 'success'; report.message = 'No changed public URLs to submit.'
    if (changes.length) {
      // Verify the deployed file first; never notify from an unverified/stale deployment.
      const verification = await fetch(keyUrl, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) })
      const text = await verification.text()
      if (!verification.ok || text.trim() !== config.key) throw new Error('The public IndexNow key file is unavailable or does not match INDEXNOW_KEY. Configure production variables and redeploy.')
      for (let offset = 0, batches = 0; offset < changes.length && batches < Math.min(5, maxBatches); offset += 1000, batches++) {
        if (Date.now() - started > budgetMs - 9000) break
        const batch = changes.slice(offset, offset + 1000)
        report.attempted += batch.length
        const response = await fetch(INDEXNOW_ENDPOINT, { method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(8000),
          body: JSON.stringify({ host: new URL(origin).hostname, key: config.key, keyLocation: keyUrl, urlList: batch.map(row => row.url) }) })
        if (response.status !== 200) {
          report.status = response.status === 202 ? 'pending' : 'failed'
          report.message = response.status === 202 ? 'IndexNow received the request and is checking the key. Unconfirmed URLs will be retried on the next sync.'
            : response.status === 429 ? 'IndexNow rate limited this request. Unsubmitted URLs remain for the next sync.'
            : `IndexNow returned HTTP ${response.status}. Check the key file and website origin; unsubmitted URLs remain for retry.`
          break
        }
        await state.bulkWrite(batch.map(row => row.removed ? { deleteOne: { filter: { _id: `url:${hash(row.url)}` } } } : {
          updateOne: { filter: { _id: `url:${hash(row.url)}` }, update: { $set: { url: row.url, fingerprint: row.fingerprint, submittedAt: new Date() } }, upsert: true },
        }))
        report.accepted += batch.length; report.remaining -= batch.length
        report.message = `${report.accepted} URL notifications accepted. ${report.remaining} remain for the next sync. Acceptance does not guarantee indexing.`
      }
      if (!report.attempted) report.message = 'Time budget reached before submission. URLs remain for the next sync.'
    }
  } catch (error) {
    report.status = 'failed'
    report.message = error instanceof Error && /^(Sitemap|The public IndexNow)/.test(error.message) ? error.message : 'IndexNow sync could not complete. Check server logs and retry; unconfirmed URLs remain pending.'
    console.error('[IndexNow] Sync failed', { name: error instanceof Error ? error.name : 'UnknownError' })
  } finally {
    if (leased) {
      try { await state.updateOne({ _id: 'report' }, { $set: { report } }, { upsert: true }) }
      finally { await state.updateOne({ _id: 'runner', owner }, { $unset: { owner: '', leaseUntil: '' } }) }
    }
  }
  return report
}
