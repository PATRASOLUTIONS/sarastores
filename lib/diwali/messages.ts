import { randomUUID } from 'node:crypto'
import type { Document, Filter } from 'mongodb'
import { getCollection, normalizeId } from '@/lib/db-service'
import type { AuthSession } from '@/lib/auth'
import { COLLECTIONS, authorize, getConfig, type StringRecord, type Claim } from './service'
import { DiwaliError } from './http'
import { sendImmediateDiwaliMessage } from './immediate-messages'

export async function listMessages(user: AuthSession['user']) {
  const config = await getConfig(), access = authorize(user, config, 'view')
  const filter = access.stores.length ? { storeCode: { $in: access.stores } } : {}
  const rows = await (await getCollection<StringRecord>(COLLECTIONS.messages)).find(filter).sort({ createdAt: -1 }).limit(100).toArray()
  return rows.map(row => {
    const { mobile, values, ...rest } = row
    return normalizeId({ ...rest, mobile: access.role === 'management' ? undefined : `${String(mobile).slice(0, 2)}******${String(mobile).slice(-2)}` })
  })
}
export async function retryMessage(user: AuthSession['user'], id: string, note: string, confirmedNotSent: boolean) {
  const config = await getConfig(), access = authorize(user, config, 'messages')
  const filter = { _id: id, ...(access.stores.length ? { storeCode: { $in: access.stores } } : {}) } as Filter<StringRecord>
  const messages = await getCollection<StringRecord>(COLLECTIONS.messages)
  const row = await messages.findOne(filter)
  if (!row) throw new DiwaliError('Message not found', 404)
  if (!['failed', 'unknown', 'ready'].includes(row.status)) throw new DiwaliError('Only failed or reconciled messages can be resent', 409)
  if (row.providerId || row.status === 'unknown' && !confirmedNotSent) throw new DiwaliError('Confirm with the provider that this message was not sent before retrying', 409)
  // One atomic document update records the operator evidence before making the event runnable.
  const immediate = row.event === 'approved' || row.event === 'registered'
  const result = await messages.updateOne({ ...filter, status: row.status, providerId: { $exists: false } }, { $set: { status: immediate ? 'ready' : 'queued', attempts: 0, nextAt: new Date(), resends: [...(row.resends || []), { actor: user.id, note, confirmedNotSent, at: new Date() }] } })
  if (!result.modifiedCount) throw new DiwaliError('Message status changed. Refresh before retrying.', 409)
  if (immediate) return { status: await sendImmediateDiwaliMessage(id) }
  return { status: 'queued' }
}
export async function processMessages() {
  if (process.env.DIWALI_MESSAGING_ENABLED !== 'true' || !process.env.ASKEVA_API_KEY || !process.env.ASKEVA_API_URL) throw new DiwaliError('Diwali messaging is disabled or not configured', 503)
  const messages = await getCollection<StringRecord>(COLLECTIONS.messages)
  // A process dying after provider acceptance is ambiguous. Never automatically resend its expired lease.
  await messages.updateMany({ status: 'sending', lockedAt: { $lt: new Date(Date.now() - 5 * 60_000) } }, { $set: { status: 'unknown', failure: 'Worker interrupted; reconcile provider acceptance before resend' } })
  let processed = 0
  for (; processed < 15; processed++) {
    const lock = randomUUID()
    const row = await messages.findOneAndUpdate({ status: 'queued', nextAt: { $lte: new Date() }, attempts: { $lt: 5 } }, { $set: { status: 'sending', lock, lockedAt: new Date() }, $inc: { attempts: 1 } }, { returnDocument: 'after', sort: { createdAt: 1 } })
    if (!row) break
    const claim = await (await getCollection<Claim>(COLLECTIONS.claims)).findOne({ _id: row.claimId, status: 'approved', whatsappConsent: true })
    if (!claim) { await messages.updateOne({ _id: row._id, lock }, { $set: { status: 'suppressed', failure: 'Claim or consent no longer permits sending' } }); continue }
    const template = row.template || process.env[`DIWALI_${row.event === 'approved' ? 'APPROVED' : 'DISPATCH'}_TEMPLATE_${String(row.language).toUpperCase()}`]
    if (!template) { await messages.updateOne({ _id: row._id, lock }, { $set: { status: 'failed', failure: 'Approved template is not configured' } }); continue }
    let patch: Document
    await messages.updateOne({ _id: row._id, lock, status: 'sending' }, { $set: { providerAttempted: true } })
    try {
      const response = await fetch(process.env.ASKEVA_API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ASKEVA_API_KEY}` },
        body: JSON.stringify({ to: `91${row.mobile}`, type: 'template', sender: process.env.ASKEVA_SENDER_NUMBER,
          template: { name: template, language: { code: row.language, policy: 'deterministic' }, components: [{ type: 'body', parameters: row.values.map((text: string) => ({ type: 'text', text })) }] } }),
        signal: AbortSignal.timeout(8000),
      })
      const payload = await response.json().catch(() => null)
      const providerId = payload?.messages?.[0]?.id
      if (response.ok && typeof providerId === 'string' && providerId.length) patch = { status: 'accepted', providerId, template, acceptedAt: new Date() }
      else if (response.status === 429 && !providerId) patch = { status: row.attempts < 5 ? 'queued' : 'failed', nextAt: new Date(Date.now() + 60_000 * 2 ** row.attempts), failure: 'Provider rate limit', httpStatus: response.status }
      else if (response.status >= 400 && response.status < 500 && !providerId) patch = { status: 'failed', failure: 'Provider rejected the template request', httpStatus: response.status }
      else patch = { status: 'unknown', failure: 'Provider acceptance could not be confirmed', httpStatus: response.status }
    } catch { patch = { status: 'unknown', failure: 'Provider timeout/network error; reconcile before resending' } }
    await messages.updateOne({ _id: row._id, lock, status: 'sending' }, { $set: patch })
    if (patch.providerId) {
      const receipt = await (await getCollection<StringRecord>(COLLECTIONS.receipts)).findOne({ _id: patch.providerId })
      if (receipt) await recordProviderStatus(patch.providerId, receipt.status, receipt.failureCode)
    }
  }
  return { processed }
}
const ranks: Record<string, number> = { accepted: 0, sent: 1, failed: 2, delivered: 3, read: 4 }
export async function recordProviderStatus(providerId: string, status: string, failureCode?: number) {
  if (!(status in ranks)) return
  const receipts = await getCollection<StringRecord>(COLLECTIONS.receipts)
  // Persist signed callbacks even if they arrive before the send response is saved.
  await receipts.updateOne({ _id: providerId }, { $max: { rank: ranks[status] }, $setOnInsert: { expiresAt: new Date(Date.now() + 7 * 86400_000) } }, { upsert: true })
  await receipts.updateOne({ _id: providerId, rank: ranks[status] }, { $set: { status, ...(failureCode ? { failureCode } : {}) } })
  const messages = await getCollection<StringRecord>(COLLECTIONS.messages)
  const row = await messages.findOne({ providerId })
  if (!row || (ranks[row.status] ?? -1) > ranks[status]) return
  const timestamp = new Date()
  await messages.updateOne({ _id: row._id, status: row.status }, { $set: { status, statusAt: timestamp, ...(failureCode ? { failure: `Provider error ${failureCode}` } : {}) } })
}
