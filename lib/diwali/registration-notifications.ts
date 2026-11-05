import { createHash, randomUUID } from 'node:crypto'
import type { ClientSession, Document } from 'mongodb'
import { getCollection, normalizeId } from '@/lib/db-service'
import { connectToDatabase } from '@/lib/mongodb'
import { sendEmail, storefrontOrigin } from '@/lib/email'
import { getEmailTransport } from '@/lib/smtp'
import { escapeHtml } from '@/lib/html'
import { DiwaliError } from './http'
import { NotificationSettingsSchema, type NotificationSettings } from './notification-types'

const SETTINGS = 'diwali_notification_settings', EMAILS = 'diwali_registration_emails'
type Row = Document & { _id: string }
type Registration = Row & { reference: string; name: string; mobile: string; email?: string; invoice: string; storeCode: string; enteredValue: number; createdAt: Date }
export function registrationEmailReady() {
  try { getEmailTransport(); return { ready: true, error: '' } }
  catch { return { ready: false, error: 'Configure valid SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM settings on the server before enabling alerts.' } }
}
async function settings(session?: ClientSession): Promise<NotificationSettings> {
  const row = await (await getCollection<Row>(SETTINGS)).findOne({ _id: '2026' }, { ...(session ? { session } : {}) })
  return NotificationSettingsSchema.parse(row ? { enabled: row.enabled, recipients: row.recipients } : { enabled: false, recipients: [] })
}
export async function getRegistrationNotifications() {
  const collection = await getCollection<Row>(EMAILS)
  const [config, emails, pending] = await Promise.all([
    settings(), collection.find({}).sort({ createdAt: -1, _id: 1 }).limit(30).toArray(), collection.countDocuments({ status: 'queued' }),
  ])
  return { settings: config, pending, smtp: registrationEmailReady(), emails: emails.map(row => normalizeId({ _id: row._id, reference: row.reference, recipient: row.recipient, status: row.status, attempts: row.attempts, createdAt: row.createdAt, acceptedAt: row.acceptedAt })) }
}
export async function saveRegistrationNotifications(actor: string, input: NotificationSettings) {
  if (input.enabled && !registrationEmailReady().ready) throw new DiwaliError(registrationEmailReady().error, 400)
  const { client } = await connectToDatabase(), session = client.startSession()
  try {
    await session.withTransaction(async () => {
      await (await getCollection<Row>(SETTINGS)).updateOne({ _id: '2026' }, { $set: { ...input, updatedAt: new Date(), updatedBy: actor } }, { session, upsert: true })
      await (await getCollection('diwali_audit')).insertOne({ actor, action: 'registration-email-settings', claimId: 'campaign', at: new Date(), enabled: input.enabled, recipientCount: input.recipients.length }, { session })
    })
  } finally { await session.endSession() }
}
export async function queueRegistrationEmails(claim: Registration, session: ClientSession) {
  const config = await settings(session)
  if (!config.enabled) return
  const emails = await getCollection<Row>(EMAILS)
  for (const recipient of config.recipients) {
    const digest = createHash('sha256').update(recipient).digest('hex')
    await emails.insertOne({ _id: `${claim._id}:${digest}`, claimId: claim._id, reference: claim.reference, recipient,
      status: 'queued', attempts: 0, createdAt: new Date() }, { session })
  }
}
export function buildRegistrationEmployeeEmail(claim: Registration) {
  const link = `${storefrontOrigin()}/admin/diwali/registrations/${encodeURIComponent(claim._id)}`
  const fields = { Reference: claim.reference, Customer: claim.name, Mobile: claim.mobile, Email: claim.email || 'Not supplied', Store: claim.storeCode, Invoice: claim.invoice,
    'Entered invoice value': `INR ${claim.enteredValue.toLocaleString('en-IN')}`, 'Registered (IST)': new Date(claim.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }
  const text = ['A customer has submitted a Diwali gift registration.', ...Object.entries(fields).map(([label, value]) => `${label}: ${value}`), 'Pending invoice verification; this is not a gift approval.', `Open registration: ${link}`].join('\n')
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#292524"><h1 style="color:#7f1d1d">New Diwali registration</h1><p>A customer has submitted a Diwali gift registration.</p><table style="width:100%;border-collapse:collapse">${Object.entries(fields).map(([label, value]) => `<tr><th style="padding:8px;text-align:left;border-bottom:1px solid #eee">${escapeHtml(label)}</th><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(value)}</td></tr>`).join('')}</table><p>Pending invoice verification; this is not a gift approval.</p><a href="${escapeHtml(link)}" style="display:inline-block;background:#7f1d1d;color:white;padding:12px 20px;border-radius:8px">Open registration</a></div>`
  return { subject: `New Diwali registration — ${claim.reference}`, html, text }
}
/** SMTP runs after the registration transaction, with one lock per recipient. */
export async function processRegistrationEmails(reference?: string) {
  if (!(await settings()).enabled || !registrationEmailReady().ready) return { processed: 0 }
  const emails = await getCollection<Row>(EMAILS), rows: Row[] = []
  for (let index = 0; index < 10; index++) {
    const lock = randomUUID()
    const row = await emails.findOneAndUpdate({ status: 'queued', ...(reference ? { reference } : {}) },
      { $set: { status: 'sending', lock, lockedAt: new Date() }, $inc: { attempts: 1 } }, { returnDocument: 'after', sort: { createdAt: 1 } })
    if (!row) break
    rows.push(row)
  }
  await Promise.all(rows.map(async row => {
    let status = 'unknown'
    try {
      // Disabling alerts or removing an employee suppresses any unsent queued emails.
      const config = await settings()
      if (!config.enabled || !config.recipients.includes(row.recipient)) status = 'failed'
      else {
        const claim = await (await getCollection<Registration>('diwali_claims')).findOne({ _id: row.claimId, deletedAt: { $exists: false } })
        if (!claim) status = 'failed'
        else {
          const outcome = await sendEmail({ to: row.recipient, ...buildRegistrationEmployeeEmail(claim) })
          if (outcome.success && 'result' in outcome) {
            const result = outcome.result as { accepted?: unknown[]; rejected?: unknown[] }
            if (result.accepted?.some(value => String(value).toLowerCase() === row.recipient)) status = 'accepted'
            else if (result.rejected?.some(value => String(value).toLowerCase() === row.recipient)) status = 'failed'
          } else if (!outcome.success && 'error' in outcome) {
            const error = outcome.error as { code?: string }
            if (['EAUTH', 'ECONNECTION', 'EDNS', 'ETLS', 'ECONNREFUSED', 'EENVELOPE', 'EMESSAGE'].includes(error?.code || '')) status = 'failed'
          }
        }
      }
    } catch { /* Keep uncertain SMTP outcomes for operator review; do not automatically resend. */ }
    await emails.updateOne({ _id: row._id, lock: row.lock, status: 'sending' }, { $set: { status, ...(status === 'accepted' ? { acceptedAt: new Date() } : {}), updatedAt: new Date() }, $unset: { lock: '', lockedAt: '' } })
  }))
  return { processed: rows.length }
}
