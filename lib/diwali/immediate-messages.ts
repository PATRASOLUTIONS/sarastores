import { randomUUID } from 'node:crypto'
import type { Document } from 'mongodb'
import { getCollection } from '@/lib/db-service'

type Message = Document & { _id: string }

/** One provider attempt after commit. Failed or uncertain sends never enter the worker queue. */
export async function sendImmediateDiwaliMessage(id: string): Promise<string> {
  const messages = await getCollection<Message>('diwali_messages')
  const lock = randomUUID()
  const identity = { $or: [{ _id: id }, { eventKey: id }] }
  const row = await messages.findOneAndUpdate({ ...identity, status: 'ready' }, {
    $set: { status: 'sending', lock, lockedAt: new Date() }, $inc: { attempts: 1 },
  }, { returnDocument: 'after' })
  if (!row) return (await messages.findOne(identity))?.status || 'suppressed'
  id = row._id
  const claim = await (await getCollection<Message>('diwali_claims')).findOne({ _id: row.claimId, whatsappConsent: true, deletedAt: { $exists: false } })
  const template = row.template || process.env[`DIWALI_${String(row.event).toUpperCase()}_TEMPLATE_${String(row.language).toUpperCase()}`]
  let patch: Document
  if (!claim || claim.status === 'rejected' || row.event === 'approved' && claim.status !== 'approved') {
    patch = { status: 'suppressed', failure: 'Claim or consent no longer permits sending' }
  } else if (process.env.DIWALI_MESSAGING_ENABLED !== 'true' || !process.env.ASKEVA_API_KEY || !process.env.ASKEVA_API_URL || !template) {
    patch = { status: 'failed', failure: 'WhatsApp provider or event template is not configured' }
  } else {
    await messages.updateOne({ _id: id, lock }, { $set: { providerAttempted: true } })
    try {
      const response = await fetch(process.env.ASKEVA_API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ASKEVA_API_KEY}` },
        body: JSON.stringify({ to: `91${row.mobile}`, type: 'template', sender: process.env.ASKEVA_SENDER_NUMBER,
          template: { name: template, language: { code: row.language, policy: 'deterministic' }, components: [{ type: 'body', parameters: row.values.map((text: string) => ({ type: 'text', text })) }] } }),
        signal: AbortSignal.timeout(8000),
      })
      const payload = await response.json().catch(() => null)
      const providerId = payload?.messages?.[0]?.id
      if (response.ok && typeof providerId === 'string' && providerId.length) patch = { status: 'accepted', template, providerId, acceptedAt: new Date() }
      else if (response.status >= 400 && response.status < 500 && !providerId) patch = { status: 'failed', failure: 'Provider rejected the template request', httpStatus: response.status }
      else patch = { status: 'unknown', failure: 'Provider acceptance could not be confirmed', httpStatus: response.status }
    } catch { patch = { status: 'unknown', failure: 'Provider timeout/network error; reconcile before resending' } }
  }
  await messages.updateOne({ _id: id, lock, status: 'sending' }, { $set: patch })
  if (patch.providerId) {
    const receipt = await (await getCollection<Message>('diwali_message_receipts')).findOne({ _id: patch.providerId })
    if (receipt?.status) {
      const ranks: Record<string, number> = { accepted: 0, sent: 1, failed: 2, delivered: 3, read: 4 }
      if ((ranks[receipt.status] ?? -1) > ranks[patch.status]) {
        await messages.updateOne({ _id: id, status: patch.status }, { $set: { status: receipt.status, statusAt: new Date(), ...(receipt.failureCode ? { failure: `Provider error ${receipt.failureCode}` } : {}) } })
        return receipt.status
      }
    }
  }
  return patch.status
}
