import { randomUUID, randomInt, createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { ClientSession, Document, Filter } from 'mongodb'
import { getCollection, normalizeId } from '@/lib/db-service'
import { connectToDatabase } from '@/lib/mongodb'
import type { AuthSession } from '@/lib/auth'
import { sendWhatsAppTemplate } from '@/lib/whatsapp-template'
import { DiwaliError } from './http'
import { ConfigSchema, DEFAULT_CONFIG, type CampaignConfig, type ClaimAction, type RegistrationSchema } from './schemas'
import type { z } from 'zod'
import { GIFTS, giftForRupees, normalizeInvoice, deliveryDueAt, indiaDate, safeCsv, isRealDate, type GiftCode } from './rules'

export const COLLECTIONS = { config: 'diwali_config', claims: 'diwali_claims', audit: 'diwali_audit', otp: 'diwali_otp', sessions: 'diwali_sessions', messages: 'diwali_messages', stock: 'diwali_stock', receipts: 'diwali_message_receipts' } as const
export type StringRecord = Document & { _id: string; resends?: Array<{ actor: string; note: string; confirmedNotSent: boolean; at: Date }> }
type User = AuthSession['user']
export type Claim = Document & {
  _id: string; reference: string; mobile: string; name: string; address: string; city: string; district: string; pincode: string;
  storeCode: string; invoice: string; enteredValue: number; language: 'en' | 'kn'; whatsappConsent: boolean;
  status: 'pending' | 'approved' | 'rejected'; fulfilment: 'pending' | 'packed' | 'dispatched' | 'delivered' | 'exception';
  version: number; createdAt: Date; updatedAt: Date; giftCode?: GiftCode; verifiedValue?: number; dueAt?: Date; deliveredAt?: Date;
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function otpHash(challenge: string, otp: string) {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret || secret.length < 16) throw new DiwaliError('Verification service is not configured', 503)
  return createHmac('sha256', secret).update(`${challenge}:${otp}`).digest('hex')
}
let initialized: Promise<void> | undefined
export function initializeDiwali() {
  if (!initialized) initialized = (async () => {
    const claims = await getCollection<Claim>(COLLECTIONS.claims)
    await claims.createIndexes([
      { key: { invoiceKey: 1 }, unique: true }, { key: { requestKey: 1 }, unique: true },
      { key: { reference: 1 }, unique: true }, { key: { mobile: 1, createdAt: -1 } },
      { key: { status: 1, storeCode: 1, createdAt: -1 } }, { key: { fulfilment: 1, dueAt: 1 } },
    ])
    await (await getCollection<StringRecord>(COLLECTIONS.messages)).createIndexes([{ key: { eventKey: 1 }, unique: true }, { key: { providerId: 1 }, sparse: true, unique: true }, { key: { status: 1, nextAt: 1 } }])
    for (const name of [COLLECTIONS.otp, COLLECTIONS.sessions, COLLECTIONS.receipts]) await (await getCollection(name)).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    await (await getCollection(COLLECTIONS.audit)).createIndex({ claimId: 1, at: -1 })
  })().catch(error => { initialized = undefined; throw error })
  return initialized
}
export async function getConfig(): Promise<CampaignConfig> {
  const row = await (await getCollection<StringRecord>(COLLECTIONS.config)).findOne({ _id: '2026' } as Filter<StringRecord>)
  if (!row) return structuredClone(DEFAULT_CONFIG)
  const { _id, updatedAt, ...config } = row
  return ConfigSchema.parse(config)
}
export function accessFor(user: User, config: CampaignConfig) {
  if (user.role === 'admin' || user.role === 'superadmin') return { role: 'superadmin' as const, export: true, stores: [] as string[] }
  if (!user.dashboardAccess) throw new DiwaliError('Campaign access denied', 403)
  const assignment = config.staff.find(staff => staff.userId === user.id)
  if (!assignment) throw new DiwaliError('Campaign access denied', 403)
  return assignment
}
export function authorize(user: User, config: CampaignConfig, capability: 'view' | 'verify' | 'fulfil' | 'settings' | 'export' | 'messages') {
  const access = accessFor(user, config)
  const allowed = access.role === 'superadmin' || capability === 'view' || capability === 'export' && access.export || capability === 'verify' && access.role === 'verifier' || capability === 'fulfil' && access.role === 'fulfilment' || capability === 'messages' && access.role === 'verifier'
  if (!allowed) {
    console.warn('[diwali] Permission denied', { actor: user.id, capability, at: new Date().toISOString() })
    throw new DiwaliError('You do not have permission for this action', 403)
  }
  return access
}
async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  await initializeDiwali()
  const { client } = await connectToDatabase()
  const session = client.startSession()
  try { return (await session.withTransaction(() => work(session))) as T } finally { await session.endSession() }
}
async function audit(session: ClientSession | undefined, actor: string, action: string, claimId: string, detail: Document = {}) {
  await (await getCollection(COLLECTIONS.audit)).insertOne({ actor, action, claimId, at: new Date(), ...detail }, { session })
}
export async function saveConfig(user: User, config: CampaignConfig) {
  authorize(user, await getConfig(), 'settings')
  if (config.enabled && (!process.env.DIWALI_OTP_TEMPLATE || process.env.DIWALI_MESSAGING_ENABLED !== 'true' || !process.env.ASKEVA_API_KEY || !process.env.ASKEVA_API_URL || !process.env.DIWALI_APPROVED_TEMPLATE_EN || !process.env.DIWALI_APPROVED_TEMPLATE_KN || !process.env.DIWALI_DISPATCH_TEMPLATE_EN || !process.env.DIWALI_DISPATCH_TEMPLATE_KN)) throw new DiwaliError('Configure OTP and bilingual approval/dispatch messaging before opening registration', 400, 'enabled')
  await transaction(async session => {
    const collection = await getCollection<StringRecord>(COLLECTIONS.config)
    const before = await collection.findOne({ _id: '2026' } as Filter<StringRecord>, { session })
    if (before && await (await getCollection(COLLECTIONS.claims)).countDocuments({}, { session }) && (before.campaignStart !== config.campaignStart || before.campaignEnd !== config.campaignEnd)) throw new DiwaliError('Purchase dates are locked after the first registration', 400, before.campaignStart !== config.campaignStart ? 'campaignStart' : 'campaignEnd')
    await collection.updateOne({ _id: '2026' } as Filter<StringRecord>, { $set: { ...config, updatedAt: new Date() } }, { upsert: true, session })
    await audit(session, user.id, 'settings', 'campaign', { before, after: config })
  })
}
export function publicConfig(config: CampaignConfig) {
  return { enabled: config.enabled, campaignStart: config.campaignStart, campaignEnd: config.campaignEnd, registrationStart: config.registrationStart, registrationEnd: config.registrationEnd, stores: config.stores, termsEn: config.termsEn, termsKn: config.termsKn, privacyEn: config.privacyEn, privacyKn: config.privacyKn, consentVersion: config.consentVersion }
}
function registrationOpen(config: CampaignConfig) {
  const today = indiaDate(new Date())
  if (!config.enabled || today < config.registrationStart || today > config.registrationEnd) throw new DiwaliError('Registration is currently closed', 409)
}
export async function sendOtp(mobile: string, language: 'en' | 'kn', purpose: 'register' | 'status' = 'register') {
  await initializeDiwali()
  if (purpose === 'register') registrationOpen(await getConfig())
  if (process.env.DIWALI_MESSAGING_ENABLED !== 'true' || !process.env.DIWALI_OTP_TEMPLATE) throw new DiwaliError('Mobile verification is not configured', 503)
  const challenge = randomUUID(), otp = String(randomInt(100000, 1000000))
  const collection = await getCollection<StringRecord>(COLLECTIONS.otp)
  await collection.insertOne({ _id: challenge, mobile, otpHash: otpHash(challenge, otp), attempts: 0, ready: false, expiresAt: new Date(Date.now() + 5 * 60_000) } as StringRecord)
  const result = await sendWhatsAppTemplate(mobile, { name: process.env.DIWALI_OTP_TEMPLATE, language: { code: language, policy: 'deterministic' }, components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] }] }, undefined, 'Diwali OTP')
  if (!result.success) { await collection.deleteOne({ _id: challenge } as Filter<StringRecord>); throw new DiwaliError('Could not send verification code. Please try again.', 503) }
  await collection.updateOne({ _id: challenge } as Filter<StringRecord>, { $set: { ready: true } })
  return challenge
}
export async function verifyOtp(challenge: string, otp: string) {
  const token = randomUUID() + randomUUID()
  return transaction(async session => {
    const collection = await getCollection<StringRecord>(COLLECTIONS.otp)
    const row = await collection.findOneAndUpdate({ _id: challenge, ready: true, consumed: { $ne: true }, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } } as Filter<StringRecord>, { $inc: { attempts: 1 } }, { session, returnDocument: 'after' })
    if (!row) throw new DiwaliError('Verification expired or too many attempts. Request a new code.', 401)
    const expected = Buffer.from(row.otpHash, 'hex'), supplied = Buffer.from(otpHash(challenge, otp), 'hex')
    // Return instead of throwing on a wrong OTP so the attempt increment commits.
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return { ok: false as const }
    await collection.updateOne({ _id: challenge } as Filter<StringRecord>, { $set: { consumed: true }, $unset: { otpHash: '' } }, { session })
    await (await getCollection<StringRecord>(COLLECTIONS.sessions)).insertOne({ _id: hash(token), mobile: row.mobile, verifiedAt: new Date(), expiresAt: new Date(Date.now() + 2 * 60 * 60_000) } as StringRecord, { session })
    return { ok: true as const, token }
  })
}
export async function customerSession(token: string | undefined) {
  if (!token || token.length > 200) throw new DiwaliError('Verify your mobile number first', 401)
  const session = await (await getCollection<StringRecord>(COLLECTIONS.sessions)).findOne({ _id: hash(token), expiresAt: { $gt: new Date() } } as Filter<StringRecord>)
  if (!session) throw new DiwaliError('Mobile verification expired. Please verify again.', 401)
  return session
}
export async function register(token: string | undefined, input: z.infer<typeof RegistrationSchema>) {
  const verified = await customerSession(token), config = await getConfig()
  const requestKey = hash(`${verified.mobile}:${input.requestId}`)
  const collection = await getCollection<Claim>(COLLECTIONS.claims)
  const prior = await collection.findOne({ requestKey, mobile: verified.mobile })
  if (prior) return customerClaim(prior)
  registrationOpen(config)
  if (input.consentVersion !== config.consentVersion) throw new DiwaliError('The consent notice changed. Refresh the page and review it again.', 409)
  if (!config.stores.some(store => store.code === input.storeCode)) throw new DiwaliError('Select a valid store')
  const normalized = normalizeInvoice(input.invoice)
  if (!normalized) throw new DiwaliError('Enter a valid invoice number')
  const claim: Claim = { ...input, _id: randomUUID(), reference: `SARA-DIW-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`, mobile: verified.mobile,
    invoice: normalized, invoiceKey: `${input.storeCode}:${normalized}`, requestKey,
    consent: { version: config.consentVersion, whatsapp: input.whatsappConsent, accuracy: true, at: new Date(), language: input.language, wording: input.language === 'kn' ? 'ನನ್ನ ನೋಂದಣಿ ಮತ್ತು ಉಡುಗೊರೆ ವಿತರಣೆ ಕುರಿತು WhatsApp ಸಂದೇಶಗಳನ್ನು ಸ್ವೀಕರಿಸಲು ನಾನು ಒಪ್ಪುತ್ತೇನೆ.' : 'I agree to receive WhatsApp updates about my registration and gift delivery.' },
    verifiedMobileAt: verified.verifiedAt, status: 'pending', fulfilment: 'pending', version: 0, createdAt: new Date(), updatedAt: new Date() }
  try {
    await transaction(async session => { await collection.insertOne(claim, { session }); await audit(session, `customer:${hash(verified.mobile)}`, 'register', claim._id) })
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    const repeated = await collection.findOne({ requestKey, mobile: verified.mobile })
    if (repeated) return customerClaim(repeated)
    throw new DiwaliError('This invoice already has a claim. Contact SARA support if it needs correction.', 409)
  }
  return customerClaim(claim)
}
function customerClaim(claim: Claim) {
  return { reference: claim.reference, status: claim.status, fulfilment: claim.status === 'approved' ? claim.fulfilment : null,
    gift: claim.status === 'approved' ? GIFTS.find(gift => gift.code === claim.giftCode)?.label : null, dueAt: claim.dueAt, courier: claim.courier, awb: claim.awb, trackingUrl: claim.trackingUrl, deliveredAt: claim.deliveredAt }
}
export async function customerClaims(token: string | undefined) {
  const session = await customerSession(token)
  return (await (await getCollection<Claim>(COLLECTIONS.claims)).find({ mobile: session.mobile }).sort({ createdAt: -1 }).limit(100).toArray()).map(customerClaim)
}
export function scopeFilter(user: User, config: CampaignConfig): Filter<Claim> {
  const access = authorize(user, config, 'view')
  return { ...(access.stores.length ? { storeCode: { $in: access.stores } } : {}), ...(access.role === 'fulfilment' ? { status: 'approved' } : {}) }
}
export async function listClaims(user: User, params: URLSearchParams) {
  const config = await getConfig(), filter = scopeFilter(user, config), access = accessFor(user, config)
  for (const key of ['status', 'fulfilment', 'storeCode', 'giftCode', 'city'] as const) {
    const value = params.get(key)
    if (value) filter[key] = value as never
  }
  // User filters never replace mandatory store restrictions.
  const scoped = { $and: [scopeFilter(user, config), filter] }
  const search = params.get('search')?.trim().slice(0, 100)
  if (search) Object.assign(filter, { $or: ['name', 'mobile', 'invoice', 'reference'].map(key => ({ [key]: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })) })
  const start = params.get('from'), end = params.get('to')
  if (start || end) {
    const dates: Document = {}
    if (start && !isRealDate(start) || end && !isRealDate(end)) throw new DiwaliError('Invalid date filter')
    if (start) dates.$gte = new Date(`${start}T00:00:00+05:30`)
    if (end) dates.$lte = new Date(`${end}T23:59:59.999+05:30`)
    filter.createdAt = dates
  }
  const page = Math.floor(Math.max(1, Math.min(10000, Number(params.get('page')) || 1))), size = 30
  const collection = await getCollection<Claim>(COLLECTIONS.claims)
  const [rows, total] = await Promise.all([collection.find(scoped).sort({ createdAt: -1 }).skip((page - 1) * size).limit(size).toArray(), collection.countDocuments(scoped)])
  await audit(undefined, user.id, 'list', 'campaign', { page, returned: rows.length })
  return { items: rows.map(row => {
    if (access.role === 'management') return { id: row._id, reference: row.reference, status: row.status, fulfilment: row.fulfilment, storeCode: row.storeCode, city: row.city, enteredValue: row.enteredValue, verifiedValue: row.verifiedValue, giftCode: row.giftCode, dueAt: row.dueAt, createdAt: row.createdAt, version: row.version }
    return normalizeId(row)
  }), total, page }
}
export async function getClaim(user: User, id: string) {
  const config = await getConfig(), access = accessFor(user, config)
  if (access.role === 'management') throw new DiwaliError('Detailed customer records are restricted', 403)
  const claim = await (await getCollection<Claim>(COLLECTIONS.claims)).findOne({ $and: [{ _id: id }, scopeFilter(user, config)] })
  if (!claim) throw new DiwaliError('Claim not found', 404)
  await audit(undefined, user.id, 'view', id)
  const history = await (await getCollection(COLLECTIONS.audit)).find({ claimId: id }).sort({ at: -1 }).limit(100).toArray()
  return { claim: normalizeId(claim), history: history.map(normalizeId) }
}
async function enqueue(session: ClientSession, claim: Claim, event: 'approved' | 'dispatch') {
  if (!claim.whatsappConsent) return
  const language = claim.language.toUpperCase(), template = process.env[`DIWALI_${event === 'approved' ? 'APPROVED' : 'DISPATCH'}_TEMPLATE_${language}`]
  const gift = GIFTS.find(item => item.code === claim.giftCode)
  const giftLabel = claim.language === 'kn' ? gift?.kannada : gift?.label
  const values = event === 'approved' ? [claim.name, giftLabel || '', claim.invoice, String(claim.verifiedValue), indiaDate(claim.dueAt!)] : [claim.name, claim.reference, String(claim.courier), String(claim.awb), String(claim.trackingUrl || 'https://www.sarastores.com/diwali-gift/status')]
  await (await getCollection<StringRecord>(COLLECTIONS.messages)).insertOne({ _id: randomUUID(), claimId: claim._id, storeCode: claim.storeCode, eventKey: `${claim._id}:${event}`, event, mobile: claim.mobile, template: template || null, language: claim.language, values, status: 'queued', attempts: 0, nextAt: new Date(), createdAt: new Date() } as StringRecord, { session })
}
export async function actOnClaim(user: User, id: string, action: ClaimAction) {
  const config = await getConfig(), verification = action.action === 'approve' || action.action === 'reject'
  const access = authorize(user, config, action.action === 'correct' ? 'settings' : verification ? 'verify' : 'fulfil')
  return transaction(async session => {
    const collection = await getCollection<Claim>(COLLECTIONS.claims)
    const claim = await collection.findOne({ $and: [{ _id: id }, scopeFilter(user, config)] }, { session })
    if (!claim) throw new DiwaliError('Claim not found', 404)
    if (claim.version !== action.version) throw new DiwaliError('Another operator updated this claim. Refresh before continuing.', 409)
    const patch: Document = { updatedAt: new Date() }
    if (action.action === 'correct') {
      if (claim.status !== 'pending') throw new DiwaliError('Invoice identity is locked after review', 409)
      if (!config.stores.some(store => store.code === action.storeCode)) throw new DiwaliError('Select a valid store')
      const invoice = normalizeInvoice(action.invoice)
      if (!invoice) throw new DiwaliError('Enter a valid invoice number')
      Object.assign(patch, { invoice, storeCode: action.storeCode, invoiceKey: `${action.storeCode}:${invoice}`, correctionNote: action.note })
    } else if (verification) {
      if (claim.status !== 'pending') throw new DiwaliError('This claim has already been reviewed', 409)
      if (action.action === 'approve') {
        if (!config.rulesConfirmed || !config.calendarConfirmed) throw new DiwaliError('Campaign rules and working-day calendar must be confirmed first', 409)
        if (action.invoiceDate < config.campaignStart || action.invoiceDate > config.campaignEnd) throw new DiwaliError('Invoice is outside the eligible purchase dates')
        if (!config.stores.some(store => store.code === action.storeCode) || action.storeCode !== claim.storeCode || access.stores.length && !access.stores.includes(action.storeCode)) throw new DiwaliError('Invoice store must match the registered store; request an audited correction if incorrect')
        const gift = giftForRupees(action.verifiedValue)
        if (!gift) throw new DiwaliError('Invoice is ineligible')
        Object.assign(patch, { status: 'approved', verifiedValue: action.verifiedValue, invoiceDate: action.invoiceDate, giftCode: gift.code, approvedAt: patch.updatedAt, approvedBy: user.id, dueAt: deliveryDueAt(patch.updatedAt, config.workingDays, config.holidays), calendar: { workingDays: config.workingDays, holidays: config.holidays }, verificationNote: action.note })
      } else Object.assign(patch, { status: 'rejected', rejectionReason: action.note, rejectedBy: user.id, rejectedAt: patch.updatedAt })
    } else {
      if (claim.status !== 'approved') throw new DiwaliError('Only approved claims may be fulfilled', 409)
      if (action.action === 'pack') {
        if (claim.fulfilment !== 'pending') throw new DiwaliError('Claim must be pending packing', 409)
        const reserved = await (await getCollection<StringRecord>(COLLECTIONS.stock)).updateOne({ _id: claim.giftCode, available: { $gte: 1 } } as Filter<StringRecord>, { $inc: { available: -1, reserved: 1 } }, { session })
        if (!reserved.modifiedCount) throw new DiwaliError('Insufficient gift stock. Add confirmed stock before packing.', 409)
        Object.assign(patch, { fulfilment: 'packed', packedAt: patch.updatedAt, packedBy: user.id })
      } else if (action.action === 'dispatch') {
        if (claim.fulfilment !== 'packed') throw new DiwaliError('Pack this claim before dispatch', 409)
        await (await getCollection<StringRecord>(COLLECTIONS.stock)).updateOne({ _id: claim.giftCode } as Filter<StringRecord>, { $inc: { reserved: -1, dispatched: 1 } }, { session })
        Object.assign(patch, { fulfilment: 'dispatched', courier: action.courier, awb: action.awb, trackingUrl: action.trackingUrl, dispatchedAt: patch.updatedAt, dispatchedBy: user.id })
      } else if (action.action === 'deliver') {
        if (claim.fulfilment !== 'dispatched') throw new DiwaliError('Dispatch this claim before delivery', 409)
        Object.assign(patch, { fulfilment: 'delivered', deliveredAt: patch.updatedAt, proof: action.proof, deliveredBy: user.id })
      } else if (action.action === 'exception') {
        if (claim.fulfilment === 'delivered' || claim.fulfilment === 'exception') throw new DiwaliError('Cannot flag this state as an exception', 409)
        Object.assign(patch, { fulfilment: 'exception', previousFulfilment: claim.fulfilment, exception: { note: action.note, nextAction: action.nextAction, at: patch.updatedAt, actor: user.id } })
      } else if (action.action === 'resume') {
        if (claim.fulfilment !== 'exception') throw new DiwaliError('This claim has no open exception', 409)
        Object.assign(patch, { fulfilment: claim.previousFulfilment || 'pending', exception: null })
      }
    }
    const result = await collection.updateOne({ _id: id, version: action.version }, { $set: patch, $inc: { version: 1 } }, { session })
    if (!result.modifiedCount) throw new DiwaliError('Claim changed; refresh and try again', 409)
    const updated = { ...claim, ...patch, version: claim.version + 1 } as Claim
    await audit(session, user.id, action.action, id, { before: { invoice: claim.invoice, storeCode: claim.storeCode, status: claim.status, fulfilment: claim.fulfilment, verifiedValue: claim.verifiedValue, version: claim.version }, after: patch, input: action })
    if (action.action === 'approve') await enqueue(session, updated, 'approved')
    if (action.action === 'dispatch') await enqueue(session, updated, 'dispatch')
    return normalizeId(updated)
  })
}
export async function addStock(user: User, giftCode: GiftCode, quantity: number, note = '') {
  authorize(user, await getConfig(), 'settings')
  await transaction(async session => {
    await (await getCollection<StringRecord>(COLLECTIONS.stock)).updateOne({ _id: giftCode } as Filter<StringRecord>, { $inc: { available: quantity, received: quantity }, $setOnInsert: { reserved: 0, dispatched: 0 } }, { upsert: true, session })
    await audit(session, user.id, 'stock-receipt', 'campaign', { giftCode, quantity, note })
  })
}
function reportFilter(user: User, config: CampaignConfig, params: URLSearchParams) {
  const filter: Document = {}
  for (const key of ['storeCode', 'city', 'giftCode', 'language', 'status']) if (params.get(key)) filter[key] = params.get(key)?.slice(0, 100)
  const start = params.get('from'), end = params.get('to')
  if (start && !isRealDate(start) || end && !isRealDate(end)) throw new DiwaliError('Invalid date filter')
  if (start || end) filter.createdAt = { ...(start ? { $gte: new Date(`${start}T00:00:00+05:30`) } : {}), ...(end ? { $lte: new Date(`${end}T23:59:59.999+05:30`) } : {}) }
  return { $and: [scopeFilter(user, config), filter] }
}
export async function reports(user: User, params: URLSearchParams) {
  const config = await getConfig(), now = new Date()
  const match = reportFilter(user, config, params)
  const rows = await (await getCollection<Claim>(COLLECTIONS.claims)).aggregate([{ $match: match }, { $facet: {
    totals: [{ $group: { _id: null, registrations: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }, verifiedValue: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$verifiedValue', 0] } }, overdue: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'approved'] }, { $lt: ['$dueAt', now] }, { $ne: ['$fulfilment', 'delivered'] }] }, 1, 0] } }, due: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'approved'] }, { $lte: ['$dueAt', now] }] }, 1, 0] } }, onTime: { $sum: { $cond: [{ $and: [{ $eq: ['$fulfilment', 'delivered'] }, { $lte: ['$dueAt', now] }, { $lte: ['$deliveredAt', '$dueAt'] }] }, 1, 0] } } } }],
    gifts: [{ $match: { status: 'approved' } }, { $group: { _id: '$giftCode', count: { $sum: 1 } } }],
    fulfilment: [{ $match: { status: 'approved' } }, { $group: { _id: '$fulfilment', count: { $sum: 1 } } }],
    stores: [{ $group: { _id: { store: '$storeCode', city: '$city' }, registrations: { $sum: 1 }, approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } }, verifiedValue: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$verifiedValue', 0] } } } }],
  } }]).toArray()
  const result = rows[0] || {}, totals = result.totals?.[0] || { registrations: 0, pending: 0, approved: 0, rejected: 0, verifiedValue: 0, overdue: 0, due: 0, onTime: 0 }
  const messages = await (await getCollection<StringRecord>(COLLECTIONS.messages)).aggregate([
    { $lookup: { from: COLLECTIONS.claims, let: { claimId: '$claimId' }, pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$claimId'] } } }, { $match: match }], as: 'claim' } },
    { $match: { 'claim.0': { $exists: true } } }, { $group: { _id: '$status', count: { $sum: 1 }, attempted: { $sum: { $cond: [{ $eq: ['$providerAttempted', true] }, 1, 0] } } } },
  ]).toArray()
  const attempted = messages.reduce((sum, row) => sum + row.attempted, 0)
  const delivered = messages.filter(row => row._id === 'delivered' || row._id === 'read').reduce((sum, row) => sum + row.count, 0)
  await audit(undefined, user.id, 'reports', 'campaign')
  return { ...result, totals, approvalRate: totals.approved + totals.rejected ? totals.approved / (totals.approved + totals.rejected) : null, slaCompliance: totals.due ? totals.onTime / totals.due : null, whatsappSuccessRate: attempted ? delivered / attempted : null, messages, stock: (await (await getCollection<StringRecord>(COLLECTIONS.stock)).find({}).toArray()).map(normalizeId) }
}
export async function exportClaims(user: User, params = new URLSearchParams()) {
  const config = await getConfig()
  authorize(user, config, 'export')
  const collection = await getCollection<Claim>(COLLECTIONS.claims), match = reportFilter(user, config, params)
  if (await collection.countDocuments(match) > 10000) throw new DiwaliError('Export exceeds 10,000 records. Use a narrower reporting scope.', 413)
  const rows = await collection.find(match).sort({ createdAt: -1 }).limit(10000).toArray()
  const fields = ['reference', 'name', 'mobile', 'address', 'city', 'district', 'pincode', 'storeCode', 'invoice', 'enteredValue', 'verifiedValue', 'status', 'giftCode', 'fulfilment', 'courier', 'awb', 'dueAt', 'deliveredAt']
  await audit(undefined, user.id, 'export', 'campaign', { count: rows.length })
  return [fields.map(safeCsv).join(','), ...rows.map(row => fields.map(field => safeCsv(row[field] instanceof Date ? row[field].toISOString() : row[field])).join(','))].join('\r\n')
}
