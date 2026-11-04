import { createHash } from 'node:crypto'
import type { ClientSession, Document } from 'mongodb'
import { getCollection, normalizeId } from '@/lib/db-service'
import { connectToDatabase } from '@/lib/mongodb'
import { DiwaliError } from './http'
import { normalizeBlocklistMobile, type BlocklistInput, type BlocklistUpdate } from './blocklist-types'

const COLLECTION = 'diwali_blocklist'
type Entry = Document & { _id: string; email: string; mobile: string; active: boolean; version: number; createdAt: Date; createdBy: string }
type Customer = { email?: string | null; mobile?: string | null; accountEmail?: string | null; accountMobile?: string | null }
let indexes: Promise<unknown> | undefined
async function ensureIndexes() {
  if (!indexes) indexes = getCollection<Entry>(COLLECTION).then(collection => collection.createIndexes([
    { key: { active: 1, email: 1 } }, { key: { active: 1, mobile: 1 } }, { key: { active: -1, updatedAt: -1, _id: 1 } },
  ])).catch(error => { indexes = undefined; throw error })
  await indexes
}
export async function isDiwaliCustomerBlocked(customer: Customer, session?: ClientSession): Promise<boolean> {
  const identities: Document[] = []
  for (const value of [customer.email, customer.accountEmail]) {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (email) identities.push({ email })
  }
  for (const value of [customer.mobile, customer.accountMobile]) {
    const mobile = normalizeBlocklistMobile(value)
    if (mobile) identities.push({ mobile })
  }
  if (!identities.length) return false
  const entry = await (await getCollection<Entry>(COLLECTION)).findOne({ active: true, $or: identities }, { projection: { _id: 1 }, ...(session ? { session } : {}) })
  return !!entry
}
export async function assertDiwaliCustomerAllowed(customer: Customer, session?: ClientSession) {
  if (await isDiwaliCustomerBlocked(customer, session)) throw new DiwaliError('Diwali registration or gift fulfilment is unavailable for these details. Please contact SARA support.', 403)
}
export async function listDiwaliBlocklist(params: URLSearchParams) {
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get('page') || '1', 10) || 1))
  const search = (params.get('search') || '').trim().slice(0, 150)
  const status = params.get('status') || 'all'
  const filter: Document = {}
  if (status === 'active' || status === 'inactive') filter.active = status === 'active'
  if (search) {
    const expression = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
    const mobile = normalizeBlocklistMobile(search)
    filter.$or = [{ email: expression }, { mobile: mobile || expression }, { reason: expression }]
  }
  const collection = await getCollection<Entry>(COLLECTION)
  const [items, total] = await Promise.all([
    collection.find(filter).sort({ active: -1, updatedAt: -1, _id: 1 }).skip((page - 1) * 30).limit(30).toArray(),
    collection.countDocuments(filter),
  ])
  return { items: items.map(normalizeId), total, page }
}
async function transaction<T>(work: (session: ClientSession) => Promise<T>) {
  await ensureIndexes()
  const { client } = await connectToDatabase(), session = client.startSession()
  try { return await session.withTransaction(() => work(session)) } finally { await session.endSession() }
}
async function recordAudit(actor: string, id: string, active: boolean, session: ClientSession) {
  await (await getCollection('diwali_audit')).insertOne({ actor, action: active ? 'customer-block' : 'customer-unblock', claimId: 'campaign', blocklistId: id, at: new Date() }, { session })
}
export async function addDiwaliBlocklist(actor: string, input: BlocklistInput) {
  const id = createHash('sha256').update(JSON.stringify([input.email, input.mobile])).digest('hex')
  return transaction(async session => {
    const collection = await getCollection<Entry>(COLLECTION)
    const current = await collection.findOne({ _id: id }, { session })
    if (current?.active) throw new DiwaliError('These details are already on the active blocklist.', 409)
    const now = new Date()
    const entry = { ...input, active: true, createdAt: current?.createdAt || now, createdBy: current?.createdBy || actor,
      updatedAt: now, updatedBy: actor, version: (current?.version || 0) + 1 }
    const result = await collection.updateOne({ _id: id, ...(current ? { version: current.version } : {}) },
      { $set: entry }, { session, upsert: !current })
    if (current && !result.modifiedCount) throw new DiwaliError('The blocklist entry changed. Refresh and try again.', 409)
    await recordAudit(actor, id, true, session)
    return normalizeId({ _id: id, ...entry })
  })
}
export async function updateDiwaliBlocklist(actor: string, input: BlocklistUpdate) {
  return transaction(async session => {
    const result = await (await getCollection<Entry>(COLLECTION)).updateOne({ _id: input.id, version: input.version },
      { $set: { active: input.active, updatedAt: new Date(), updatedBy: actor }, $inc: { version: 1 } }, { session })
    if (!result.modifiedCount) throw new DiwaliError('The blocklist entry changed or no longer exists. Refresh and try again.', 409)
    await recordAudit(actor, input.id, input.active, session)
    return { saved: true }
  })
}
