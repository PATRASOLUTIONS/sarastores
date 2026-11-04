import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'

function fixture() {
  let entries = new Map(), writes = [], claims = null, failAudit = false
  const sent = [], indexes = [], reads = []
  const defaults = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  const config = { ...defaults, enabled: true, rulesConfirmed: true, calendarConfirmed: true,
    campaignStart: '2000-01-01', campaignEnd: '2099-12-31', registrationStart: '2000-01-01', registrationEnd: '2099-12-31',
    termsEn: 'Approved', termsKn: 'Approved', privacyEn: 'Approved', privacyKn: 'Approved', stores: [{ code: 'A', name: 'Synthetic store' }] }
  const matches = (record, query) => Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(part => matches(record, part))
    if (key === '$and') return value.every(part => matches(record, part))
    if (value && typeof value === 'object' && '$regex' in value) return new RegExp(value.$regex, value.$options).test(record[key] || '')
    return record[key] === value
  })
  const session = {
    async withTransaction(work) {
      const before = [structuredClone(entries), [...writes]]
      try { return await work() } catch (error) { [entries, writes] = before; throw error }
    }, async endSession() {},
  }
  const loader = sourceLoader({
    '@/lib/db-service': {
      normalizeId: row => { const { _id, ...rest } = row; return { ...rest, id: String(_id) } },
      getCollection: async name => ({
        createIndexes: async value => { indexes.push({ name, value }) }, createIndex: async () => {},
        findOne: async (query, options) => {
          reads.push({ name, query, options })
          if (name === 'diwali_blocklist') return [...entries.values()].find(row => matches(row, query)) || null
          if (name === 'diwali_config') return { _id: '2026', ...config }
          if (name === 'diwali_sessions') return { mobile: '9876543210' }
          if (name === 'diwali_claims') return claims
          return null
        },
        find(query) {
          let skip = 0, limit = Infinity
          return { sort() { return this }, skip(value) { skip = value; return this }, limit(value) { limit = value; return this },
            toArray: async () => [...entries.values()].filter(row => matches(row, query)).slice(skip, skip + limit) }
        },
        countDocuments: async query => [...entries.values()].filter(row => matches(row, query)).length,
        updateOne: async (query, patch, options) => {
          if (name !== 'diwali_blocklist') { writes.push({ name, query, patch }); return { modifiedCount: 1 } }
          const current = entries.get(query._id)
          if (!current && !options?.upsert || current && !matches(current, query)) return { modifiedCount: 0 }
          const row = { ...current, _id: query._id, ...patch.$set }
          if (patch.$inc?.version) row.version += patch.$inc.version
          entries.set(row._id, row)
          return { modifiedCount: 1, upsertedCount: current ? 0 : 1 }
        },
        insertOne: async (row, options) => { if (name === 'diwali_audit' && failAudit) throw new Error('Synthetic audit failure'); writes.push({ name, row, options }) },
        deleteOne: async () => {},
      }),
    },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession: () => session } }) },
    '@/lib/whatsapp-template': { sendWhatsAppTemplate: async (...args) => { sent.push(args); return { success: true } } },
  }, { env: { DIWALI_MESSAGING_ENABLED: 'true', DIWALI_OTP_TEMPLATE: 'synthetic-auth' } })
  return { loader, config, sent, indexes, reads, session, get writes() { return writes },
    block(row) { entries.set(String(entries.size), { _id: String(entries.size), active: true, ...row }) },
    claim(row) { claims = row }, failAudit() { failAudit = true }, entries: () => [...entries.values()] }
}

test('blocklist accepts either identifier, normalizes case and +91, and rejects malformed inputs or actor injection', () => {
  const { BlocklistInputSchema, normalizeBlocklistMobile } = sourceLoader().load('lib/diwali/blocklist-types.ts')
  const normalized = BlocklistInputSchema.parse({ email: ' Shopper@Example.com ', mobile: '+91 98765 43210', reason: 'Review required' })
  assert.equal(normalized.email, 'shopper@example.com')
  assert.equal(normalized.mobile, '9876543210')
  assert.equal(BlocklistInputSchema.parse({ email: 'shopper@example.com', reason: 'Review required' }).mobile, '')
  assert.equal(BlocklistInputSchema.parse({ mobile: '9876543210', reason: 'Review required' }).email, '')
  for (const input of [{ reason: 'Review required' }, { mobile: '12345', reason: 'Review required' },
    { mobile: 'text9876543210', reason: 'Review required' }, { email: 'invalid', reason: 'Review required' },
    { mobile: '9876543210', reason: 'Review required', createdBy: 'forged-admin' }]) assert.equal(BlocklistInputSchema.safeParse(input).success, false)
  assert.equal(normalizeBlocklistMobile('09876543210'), '9876543210')
})

test('either matching identifier blocks a customer; inactive and unrelated entries do not', async () => {
  const f = fixture(), service = f.loader.load('lib/diwali/blocklist.ts')
  f.block({ email: 'shopper@example.com', mobile: '9876543210' })
  f.block({ email: 'allowed@example.com', mobile: '9123456789', active: false })
  for (const customer of [{ email: ' SHOPPER@EXAMPLE.COM ' }, { mobile: '+91 98765 43210' },
    { email: 'other@example.com', mobile: '9876543210' }, { accountEmail: 'shopper@example.com', email: 'billing@example.com' }]) {
    assert.equal(await service.isDiwaliCustomerBlocked(customer), true)
  }
  assert.equal(await service.isDiwaliCustomerBlocked({ email: 'allowed@example.com', mobile: '9123456789' }), false)
  assert.equal(await service.isDiwaliCustomerBlocked({}), false)
  assert.equal(f.reads[0].options.projection._id, 1, 'Public checks never read internal reasons')
})

test('administrators can block, unblock and reactivate with version checks and an audit trail', async () => {
  const f = fixture(), service = f.loader.load('lib/diwali/blocklist.ts')
  const input = { email: 'shopper@example.com', mobile: '', reason: 'Synthetic review' }
  const entry = await service.addDiwaliBlocklist('session-admin', input)
  assert.equal(entry.createdBy, 'session-admin')
  assert.equal(entry.active, true)
  assert.equal(entry.version, 1)
  assert.equal(f.indexes[0].name, 'diwali_blocklist')
  await assert.rejects(service.addDiwaliBlocklist('session-admin', input), /already/)
  await service.updateDiwaliBlocklist('session-admin', { id: entry.id, version: 1, active: false })
  assert.equal(await service.isDiwaliCustomerBlocked({ email: input.email }), false)
  await assert.rejects(service.updateDiwaliBlocklist('session-admin', { id: entry.id, version: 1, active: true }), /changed/)
  const again = await service.addDiwaliBlocklist('second-session-admin', input)
  assert.equal(again.id, entry.id)
  assert.equal(again.version, 3)
  assert.equal(again.createdBy, 'session-admin')
  assert.equal(again.updatedBy, 'second-session-admin')
  assert.deepEqual(f.writes.filter(write => write.name === 'diwali_audit').map(write => write.row.action), ['customer-block', 'customer-unblock', 'customer-block'])
  assert.ok(f.writes.every(write => write.options.session === f.session))
  assert.equal((await service.listDiwaliBlocklist(new URLSearchParams({ search: 'SHOPPER@', status: 'active' }))).total, 1)
})

test('unblocking one entry does not override another active identifier match', async () => {
  const f = fixture(), service = f.loader.load('lib/diwali/blocklist.ts')
  const email = await service.addDiwaliBlocklist('admin', { email: 'shopper@example.com', mobile: '', reason: 'Review email' })
  await service.addDiwaliBlocklist('admin', { email: '', mobile: '9876543210', reason: 'Review mobile' })
  await service.updateDiwaliBlocklist('admin', { id: email.id, version: 1, active: false })
  assert.equal(await service.isDiwaliCustomerBlocked({ email: 'shopper@example.com', mobile: '9876543210' }), true)
})

test('failed audit writes roll back both blocking and unblocking', async () => {
  const f = fixture(), service = f.loader.load('lib/diwali/blocklist.ts')
  const entry = await service.addDiwaliBlocklist('admin', { email: 'shopper@example.com', mobile: '', reason: 'Review email' })
  f.failAudit()
  await assert.rejects(service.updateDiwaliBlocklist('admin', { id: entry.id, version: 1, active: false }), /audit failure/)
  assert.equal(await service.isDiwaliCustomerBlocked({ email: 'shopper@example.com' }), true)
  assert.equal(f.entries()[0].version, 1)
  await assert.rejects(service.addDiwaliBlocklist('admin', { email: '', mobile: '9123456789', reason: 'Review mobile' }), /audit failure/)
  assert.equal(f.entries().length, 1)
  assert.equal(f.writes.length, 1)
})

test('email-only blocklist entries stop registration OTP before provider calls', async () => {
  const f = fixture()
  f.block({ email: 'shopper@example.com' })
  await assert.rejects(f.loader.load('lib/diwali/service.ts').sendOtp('9876543210', 'kn', 'register', ' SHOPPER@EXAMPLE.COM '), /unavailable/)
  assert.equal(f.sent.length, 0)
  assert.equal(f.writes.length, 0)
})

test('blocked registration OTPs never contact the provider; existing status access remains available', async () => {
  const f = fixture(), service = f.loader.load('lib/diwali/service.ts')
  f.block({ mobile: '9876543210' })
  await assert.rejects(service.sendOtp('9876543210', 'en', 'register', 'shopper@example.com'), /unavailable/)
  assert.equal(f.sent.length, 0)
  assert.equal(f.writes.length, 0)
  await service.sendOtp('9876543210', 'en', 'status')
  assert.equal(f.sent.length, 1)
})

test('a previously verified mobile cannot register after blocking, and email-only blocks are also enforced', async () => {
  for (const identity of [{ mobile: '9876543210' }, { email: 'shopper@example.com' }]) {
    const f = fixture(), service = f.loader.load('lib/diwali/service.ts')
    f.block(identity)
    await assert.rejects(service.register('synthetic-verified-cookie', { email: 'shopper@example.com', requestId: 'synthetic-request' }), /unavailable/)
    assert.equal(f.writes.length, 0)
  }
  const schema = sourceLoader().load('lib/diwali/schemas.ts').RegistrationSchema
  assert.equal(schema.safeParse({ email: '', mobile: 'forged' }).success, false)
})

test('existing gift approval, packing and dispatch enforce current blocklist without touching stock', async () => {
  for (const action of ['approve', 'pack', 'dispatch']) {
    const f = fixture()
    f.block({ email: 'shopper@example.com' })
    f.claim({ _id: 'synthetic-claim', mobile: '9876543210', email: 'shopper@example.com', status: 'approved', fulfilment: 'packed' })
    await assert.rejects(f.loader.load('lib/diwali/service.ts').actOnClaim({ id: 'session-admin', role: 'admin' }, 'synthetic-claim', { action, version: 0 }), /unavailable/)
    assert.equal(f.writes.length, 0)
  }
})

test('blocked online customers lose gift eligibility without changing purchase amounts, including account-email matches', async () => {
  const f = fixture(), service = f.loader.load('lib/diwali/online-orders.ts')
  f.block({ email: 'account@example.com' })
  const order = { orderId: 'synthetic-order', userId: 'session-customer', paymentMethod: 'razorpay', total: 26000, shipping: 0,
    createdAt: new Date('2026-11-07'), customer: { email: 'billing@example.com', phone: '9876543210' }, accountEmail: 'account@example.com' }
  assert.equal(await service.prepareOnlineDiwaliOrder(order), null)
  assert.equal(order.total, 26000)
  await assert.rejects(service.recordOnlineDiwaliOrder({ ...order, diwaliGift: { giftCode: 'silver10', eligibleValue: 26000 } }, f.session), /unavailable/)
  assert.equal(f.writes.length, 0)
})

test('blocklist API rejects non-admins and cross-site writes before accessing records', async () => {
  let allowed = false, operations = 0
  const api = sourceLoader({
    '@/lib/auth': { requireFullAdmin: async () => allowed ? { ok: true, user: { id: 'session-admin' } } : { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) } },
    '@/lib/diwali/blocklist': { listDiwaliBlocklist: async () => { operations++ }, addDiwaliBlocklist: async () => { operations++ }, updateDiwaliBlocklist: async () => { operations++ } },
  }).load('app/api/admin/diwali/blocklist/route.ts')
  for (const method of ['GET', 'POST', 'PUT']) {
    const response = await api[method](new Request('https://sara.test/api/admin/diwali/blocklist', { method }))
    assert.equal(response.status, 403)
  }
  allowed = true
  const response = await api.POST(new Request('https://sara.test/api/admin/diwali/blocklist', { method: 'POST', headers: { origin: 'https://attacker.test', 'Content-Type': 'application/json' }, body: '{}' }))
  assert.equal(response.status, 403)
  assert.equal(operations, 0)
})

test('blocklist API derives audit actor from the session and returns private uncached responses', async () => {
  let actor
  const api = sourceLoader({
    '@/lib/auth': { requireFullAdmin: async () => ({ ok: true, user: { id: 'trusted-session-admin' } }) },
    '@/lib/diwali/blocklist': { addDiwaliBlocklist: async (id, input) => { actor = id; return input } },
  }).load('app/api/admin/diwali/blocklist/route.ts')
  const request = value => new Request('https://sara.test/api/admin/diwali/blocklist', { method: 'POST', headers: { origin: 'https://sara.test', 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
  const response = await api.POST(request({ mobile: '+91 9876543210', reason: 'Synthetic review' }))
  assert.equal(response.status, 201)
  assert.equal(actor, 'trusted-session-admin')
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
  assert.equal((await api.POST(request({ mobile: '9876543210', reason: 'Review', createdBy: 'forged' }))).status, 400)
})

test('public eligibility exposes only a boolean and the blocklist page has a server role gate', async () => {
  const loader = sourceLoader({
    '@/lib/auth': { getSession: async () => ({ user: { email: 'shopper@example.com', phone: '9876543210' } }) },
    '@/lib/diwali/service': { getConfig: async () => ({ enabled: true }), publicConfig: config => config },
    '@/lib/diwali/blocklist': { isDiwaliCustomerBlocked: async () => true },
  })
  const value = await (await loader.load('app/api/diwali/config/route.ts').GET()).json()
  assert.equal(value.customerAllowed, false)
  assert.equal(value.email, undefined)
  assert.equal(value.reason, undefined)
  const page = sourceLoader({
    '@/lib/auth': { getSession: async () => ({ user: { role: 'user' } }) },
    'next/navigation': { redirect: path => { throw new Error(`REDIRECT:${path}`) } },
    '@/components/diwali/DiwaliBlocklist': () => null,
  }).load('app/admin/diwali/blocklist/page.tsx')
  await assert.rejects(page.default(), /REDIRECT:\/admin\/diwali/)
})
