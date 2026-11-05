import { createHmac, timingSafeEqual } from 'node:crypto'
import { ObjectId, type Document, type Filter } from 'mongodb'
import { getCollection } from '@/lib/db-service'
import { staffCanAccessPage } from '@/lib/admin-access'
import type { StoredStoreLocation } from '@/lib/store-locations'
import type { CampaignConfig } from './schemas'
import type { CampaignDirectoryStore } from './store-types'
import { indiaDate } from './rules'
import { DiwaliError } from './http'

export const STORE_REFERRAL_COOKIE = 'diwali_store_referral'
export const STORE_REFERRAL_AGE = 7 * 24 * 60 * 60
const METRICS = 'diwali_store_opens'
const RETAIL_FILTER: Filter<StoredStoreLocation> = { $or: [{ locationType: 'store' }, { locationType: { $exists: false } }, { locationType: null }] }
const encode = (value: string) => Buffer.from(value).toString('base64url')
function decode(value: string) {
  if (!/^[A-Za-z0-9_-]{1,270}$/.test(value)) return null
  const decoded = Buffer.from(value, 'base64url').toString('utf8')
  return encode(decoded) === value && decoded.length <= 200 ? decoded : null
}
const tokenFor = (prefix: 's' | 'c', value: string) => `${prefix}_${encode(value)}`
function parseStoreToken(token: string) {
  if (!/^[sc]_/.test(token)) return null
  const value = decode(token.slice(2))
  return value ? { physical: token[0] === 's', value } : null
}
export async function campaignStoreDirectory(): Promise<CampaignDirectoryStore[]> {
  const rows = await (await getCollection<StoredStoreLocation>('store_locations')).find(RETAIL_FILTER,
    { projection: { shopName: 1, storeCode: 1, isActive: 1 } }).sort({ shopName: 1, _id: 1 }).toArray()
  return rows.map(row => ({ id: row._id.toString(), code: String(row.storeCode || '').trim(), name: String(row.shopName || '').trim(), active: row.isActive === true }))
}
export async function resolveStoreLink(token: string, config: CampaignConfig) {
  const parsed = parseStoreToken(token)
  if (!parsed) return null
  if (!parsed.physical) {
    const store = config.stores.find(store => store.code === parsed.value && store.code !== 'ONLINE')
    return store ? { id: token, code: store.code, name: store.name, active: true } : null
  }
  const identities: Filter<StoredStoreLocation>[] = [{ _id: parsed.value }, { id: parsed.value }]
  if (/^[a-f\d]{24}$/i.test(parsed.value)) identities.push({ _id: new ObjectId(parsed.value) })
  const row = await (await getCollection<StoredStoreLocation>('store_locations')).findOne({ $and: [RETAIL_FILTER, { $or: identities }] }, { projection: { storeCode: 1, shopName: 1, isActive: 1 } })
  return row ? { id: token, code: String(row.storeCode || '').trim(), name: String(row.shopName || '').trim(), active: row.isActive === true } : null
}
export async function listStoreLinks(config: CampaignConfig, scope: string[], origin: string, claimScope: Document = {}) {
  const directory = await campaignStoreDirectory()
  const physical = directory.map(store => ({ ...store, id: tokenFor('s', store.id) }))
  const manual = config.stores.filter(store => store.code !== 'ONLINE' && !directory.some(location => location.code === store.code))
    .map(store => ({ ...store, id: tokenFor('c', store.code), active: true }))
  const stores = [...physical, ...manual].filter(store => !scope.length || scope.includes(store.code))
  const ids = stores.map(store => store.id)
  const metrics = ids.length ? await (await getCollection<Document & { _id: string }>(METRICS)).find({ _id: { $in: ids } }).toArray() : []
  const registrations = ids.length ? await (await getCollection('diwali_claims')).aggregate([
    { $match: { $and: [claimScope, { referralStoreId: { $in: ids }, deletedAt: { $exists: false } }] } }, { $group: { _id: '$referralStoreId', count: { $sum: 1 } } },
  ]).toArray() : []
  return stores.map(store => {
    const metric = metrics.find(row => row._id.toString() === store.id)
    return { ...store, inCampaign: config.stores.some(item => item.code === store.code),
      url: new URL(`/diwali-gift/store/${store.id}`, origin).href,
      opens: Number(metric?.opens || 0), registrations: Number(registrations.find(row => row._id === store.id)?.count || 0),
      lastOpenedAt: metric?.lastOpenedAt ? new Date(metric.lastOpenedAt).toISOString() : null,
    }
  })
}
export async function recordStoreOpen(store: { id: string; code: string; name: string }, at = new Date()) {
  await (await getCollection<Document & { _id: string }>(METRICS)).updateOne({ _id: store.id }, {
    $inc: { opens: 1, [`days.${indiaDate(at)}`]: 1 }, $set: { code: store.code, name: store.name, lastOpenedAt: at }, $setOnInsert: { firstOpenedAt: at },
  }, { upsert: true })
}
function referralSecret() { const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET; return secret && secret.length >= 16 ? secret : null }
function referralSignature(value: string, secret: string) { return createHmac('sha256', secret).update(`diwali-store:${value}`).digest('hex') }
export function createStoreReferral(token: string, at = Date.now()) {
  const secret = referralSecret()
  if (!secret || !parseStoreToken(token)) return null
  const payload = `${token}.${at}`
  return `${payload}.${referralSignature(payload, secret)}`
}
export function readStoreReferral(cookie?: string, now = Date.now()) {
  const secret = referralSecret()
  if (!secret || !cookie || cookie.length > 400) return null
  const [id, timestamp, signature, extra] = cookie.split('.')
  const at = Number(timestamp)
  if (extra || !parseStoreToken(id) || !/^\d{13}$/.test(timestamp || '') || !/^[a-f\d]{64}$/.test(signature || '') || at > now + 60_000 || now - at > STORE_REFERRAL_AGE * 1000) return null
  const expected = Buffer.from(referralSignature(`${id}.${timestamp}`, secret), 'hex')
  return timingSafeEqual(expected, Buffer.from(signature, 'hex')) ? { id, at: new Date(at) } : null
}
export function shouldCountStoreOpen(request: Request) {
  return request.method === 'GET' && !/bot|crawler|spider|preview/i.test(request.headers.get('user-agent') || '')
    && !/prefetch/i.test(`${request.headers.get('purpose') || ''} ${request.headers.get('sec-purpose') || ''}`)
    && !request.headers.has('next-router-prefetch') && !request.headers.has('rsc')
}
export async function campaignAccounts(config: CampaignConfig, search = '') {
  const assigned = config.staff.map(staff => staff.userId)
  const ids = assigned.filter(id => /^[a-f\d]{24}$/i.test(id)).map(id => new ObjectId(id))
  const text = search.trim().slice(0, 100)
  const query = text.length >= 2 ? { $or: [
    { name: { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    { email: { $regex: text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
  ] } : { $or: [{ dashboardAccess: true }, { role: { $in: ['admin', 'superadmin'] } }, { _id: { $in: [...ids, ...assigned] } }, { id: { $in: assigned } }] }
  const collection = await getCollection<Document & { _id: string | ObjectId }>('users')
  const projection = { name: 1, email: 1, role: 1, dashboardAccess: 1, allowedPages: 1, status: 1, isActive: 1, id: 1 }
  const rows = await collection.find(query, { projection }).sort({ name: 1 }).limit(100).toArray()
  const missingAssigned = assigned.filter(id => !rows.some(row => row._id.toString() === id))
  const additional = missingAssigned.length ? await collection.find({ $or: [{ _id: { $in: [...ids, ...missingAssigned] } }, { id: { $in: missingAssigned } }] }, { projection }).toArray() : []
  return [...rows, ...additional.filter(row => !rows.some(item => item._id.toString() === row._id.toString()))].map(row => ({
    id: row._id.toString(), name: String(row.name || ''), email: String(row.email || ''),
    active: row.status !== 'inactive' && row.isActive !== false,
    ready: staffCanAccessPage({ role: String(row.role || 'user'), dashboardAccess: row.dashboardAccess === true, allowedPages: Array.isArray(row.allowedPages) ? row.allowedPages : [] }, '/admin/diwali'),
    admin: row.role === 'admin' || row.role === 'superadmin',
  }))
}
export async function validateCampaignStaff(config: CampaignConfig) {
  if (!config.staff.length) return
  const accounts = await campaignAccounts(config)
  for (const assignment of config.staff) {
    const account = accounts.find(account => account.id === assignment.userId)
    if (!account) throw new DiwaliError('Choose an existing account for every staff assignment.', 400, 'staff')
    if (config.enabled && (!account.active || !account.ready)) throw new DiwaliError(`${account.name || account.email}: enable active status, dashboard access and the /admin/diwali page grant in account administration.`, 400, 'staff')
  }
}
