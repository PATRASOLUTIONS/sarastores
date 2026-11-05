import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'
import * as XLSX from 'xlsx'

function fixture({ stage = 'pending', status = 'pending', consent = true, provider = 'accepted' } = {}) {
  const calls = [], records = new Map()
  const config = { enabled: true, rulesConfirmed: true, calendarConfirmed: true, campaignStart: '2026-11-05', campaignEnd: '2026-11-15',
    registrationStart: '2000-01-01', registrationEnd: '2099-12-31', consentVersion: 'fixture-v1',
    termsEn: 'Fixture terms', termsKn: 'Fixture terms', privacyEn: 'Fixture privacy', privacyKn: 'Fixture privacy',
    workingDays: [1, 2, 3, 4, 5, 6], holidays: [], stores: [{ code: 'A', name: 'Fixture store' }],
    staff: [{ userId: 'f', role: 'fulfilment', stores: ['A'], export: false }, { userId: 'v', role: 'verifier', stores: ['A'], export: false }] }
  records.set('diwali_config', [{ _id: '2026', ...config }])
  records.set('diwali_claims', [{ _id: 'claim', reference: 'FIXTURE-CLAIM', name: 'Fixture customer', mobile: '9876543210', email: 'fixture@example.invalid', storeCode: 'A', invoice: 'FIXTURE-1',
    enteredValue: 26000, status, fulfilment: stage, version: 0, whatsappConsent: consent, language: 'en', giftCode: 'silver10', createdAt: new Date() }])
  records.set('diwali_stock', [{ _id: 'silver10', available: 2, reserved: 1, dispatched: 0 }])
  records.set('users', [{ _id: 'legacy-admin', name: 'Legacy Approver' }])
  let inTransaction = false
  function matches(row, filter) {
    return Object.entries(filter).every(([key, value]) => {
      if (key === '$and') return value.every(part => matches(row, part))
      if (key === '$or') return value.some(part => matches(row, part))
      if (value && typeof value === 'object') {
        if ('$in' in value) return value.$in.map(String).includes(String(row[key]))
        if ('$gte' in value) return row[key] >= value.$gte
      }
      return row[key] === value
    })
  }
  function apply(row, update) {
    Object.assign(row, update.$set)
    for (const [key, amount] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + amount
  }
  const collection = name => {
    if (!records.has(name)) records.set(name, [])
    const rows = records.get(name)
    return {
      createIndexes: async () => {}, createIndex: async () => {},
      async findOne(filter) { return structuredClone(rows.find(row => matches(row, filter)) || null) },
      find(filter) { const cursor = { sort() { return cursor }, limit() { return cursor }, async toArray() { return rows.filter(row => matches(row, filter)) } }; return cursor },
      async countDocuments(filter) { return rows.filter(row => matches(row, filter)).length },
      async insertOne(row) { rows.push(structuredClone(row)) },
      async updateOne(filter, update) { const row = rows.find(row => matches(row, filter)); if (!row) return { modifiedCount: 0 }; apply(row, update); return { modifiedCount: 1 } },
      async updateMany(filter, update) { rows.filter(row => matches(row, filter)).forEach(row => apply(row, update)) },
      async findOneAndUpdate(filter, update) { const row = rows.find(row => matches(row, filter)); if (!row) return null; apply(row, update); return structuredClone(row) },
    }
  }
  const loader = sourceLoader({
    '@/lib/auth': { requireUser: async () => ({ ok: true, user: admin }) },
    '@/lib/db-service': { getCollection: async name => collection(name), normalizeId: row => ({ ...row, id: row._id }) },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession: () => ({ async withTransaction(work) { inTransaction = true; try { return await work() } finally { inTransaction = false } }, async endSession() {} }) } }) },
    '@/lib/diwali/blocklist': { assertDiwaliCustomerAllowed: async () => {} },
  }, { env: { DIWALI_MESSAGING_ENABLED: 'true', ASKEVA_API_KEY: 'fixture-key', ASKEVA_API_URL: 'https://provider.fixture.invalid', DIWALI_APPROVED_TEMPLATE_EN: 'fixture_approval' },
    fetch: async (_url, options) => {
      assert.equal(inTransaction, false, 'Provider calls must happen after the transaction commits')
      calls.push(JSON.parse(options.body))
      if (provider === 'timeout') throw new Error('Synthetic timeout')
      return Response.json(provider === 'accepted' ? { messages: [{ id: 'fixture-message' }] } : {}, { status: provider === 'limited' ? 429 : 200 })
    },
  })
  return { loader, calls, records, service: loader.load('lib/diwali/service.ts') }
}
const admin = { id: 'admin', name: 'Fixture Approver', email: 'admin@example.invalid', role: 'admin' }
const staff = id => ({ id, role: 'user', dashboardAccess: true, allowedPages: ['/admin/diwali'] })
const approval = { action: 'approve', version: 0, verifiedValue: 26000, invoiceDate: '2026-11-05', storeCode: 'A', invoiceValid: true, notRefunded: true }

test('approval requires matched invoice but no review note, rejection requires a reason', () => {
  const { ActionSchema } = sourceLoader().load('lib/diwali/schemas.ts')
  assert.equal(ActionSchema.parse(approval).note, '')
  assert.equal(ActionSchema.safeParse({ ...approval, invoiceValid: false }).success, false)
  assert.equal(ActionSchema.safeParse({ action: 'reject', version: 0, note: '' }).success, false)
})

test('approval sends once immediately after commit and exports the approving employee', async () => {
  const f = fixture(), action = f.loader.load('lib/diwali/schemas.ts').ActionSchema.parse(approval)
  const result = await f.service.actOnClaim(admin, 'claim', action)
  assert.equal(result.whatsappStatus, 'accepted')
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].template.name, 'fixture_approval')
  assert.equal(f.records.get('diwali_messages')[0].status, 'accepted')
  await assert.rejects(f.service.actOnClaim(admin, 'claim', action), /updated|reviewed/)
  assert.equal(f.calls.length, 1)
  const csv = await f.service.exportClaims(admin)
  assert.match(csv, /approvedByName/)
  assert.match(csv, /Fixture Approver/)
  assert.match(csv, /approvedAt/)
})

for (const provider of ['timeout', 'limited']) {
  test(`immediate approval ${provider} never queues an automatic retry`, async () => {
    const f = fixture({ provider })
    const result = await f.service.actOnClaim(admin, 'claim', f.loader.load('lib/diwali/schemas.ts').ActionSchema.parse(approval))
    assert.equal(result.status, 'approved')
    assert.equal(result.whatsappStatus, provider === 'timeout' ? 'unknown' : 'failed')
    assert.notEqual(f.records.get('diwali_messages')[0].status, 'queued')
  })
}

test('approval preserves customer WhatsApp opt-out', async () => {
  const f = fixture({ consent: false })
  await f.service.actOnClaim(admin, 'claim', f.loader.load('lib/diwali/schemas.ts').ActionSchema.parse(approval))
  assert.equal(f.calls.length, 0)
  assert.equal(f.records.get('diwali_messages').length, 0)
})

test('downloaded Excel report identifies the approver by name and account ID', async () => {
  const f = fixture({ consent: false })
  await f.service.actOnClaim(admin, 'claim', f.loader.load('lib/diwali/schemas.ts').ActionSchema.parse(approval))
  const response = await f.loader.load('app/api/admin/diwali/reports/route.ts').GET(new Request('https://fixture.invalid/api/admin/diwali/reports?format=xlsx'))
  assert.equal(response.status, 200)
  const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: 'array' })
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]])
  assert.equal(rows[0].approvedByName, 'Fixture Approver')
  assert.equal(rows[0].approvedBy, 'admin')
  assert.ok(rows[0].approvedAt)
})

test('approval defaults to today in India, matched invoice, green approval and a reason required only for rejection', async () => {
  const state = [], effects = []
  let index = 0
  const config = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  const loader = sourceLoader({
    react: {
      useEffect(callback) { effects.push(callback) },
      useState(initial) { const current = index++; if (!(current in state)) state[current] = initial; return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value }] },
    },
    'next/navigation': { useRouter: () => ({}) },
    '@/lib/api-client': { apiFetch: async url => Response.json(url.endsWith('/config') ? { config, access: { role: 'superadmin' } } : { claim: { id: 'claim', source: 'store', status: 'pending', enteredValue: 26000, city: 'Fixture city', createdAt: new Date().toISOString() }, history: [] }) },
  })
  const Component = loader.load('components/diwali/AdminGift.tsx').default
  Component({ section: 'detail', claimId: 'claim' })
  await effects[0]()
  // The effect delegates to an async task; wait for its chained API reads.
  await new Promise(resolve => setImmediate(resolve))
  index = 0
  const nodes = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || !node.props) return; nodes.push(node); visit(node.props.children) }
  visit(Component({ section: 'detail', claimId: 'claim' }))
  const today = loader.load('lib/diwali/rules.ts').indiaDate(new Date())
  assert.equal(nodes.find(node => node.type === 'input' && node.props.type === 'date').props.value, today)
  assert.equal(nodes.find(node => node.type === 'input' && node.props.type === 'checkbox').props.checked, true)
  const approve = nodes.find(node => node.type === 'button' && node.props.children === 'Approve and allocate gift')
  assert.match(approve.props.className, /bg-green-/)
  assert.equal(approve.props.disabled, false)
  assert.equal(nodes.find(node => node.type === 'button' && node.props.children === 'Reject').props.disabled, true)
})

test('fulfilment rejection releases packed stock and suppresses unsent notifications', async () => {
  const f = fixture({ status: 'approved', stage: 'packed' })
  f.records.set('diwali_messages', [{ _id: 'dispatch', claimId: 'claim', status: 'queued' }])
  const result = await f.service.actOnClaim(staff('f'), 'claim', { action: 'reject', version: 0, note: 'Incorrect invoice' })
  assert.equal(result.status, 'rejected')
  assert.equal(result.fulfilment, 'rejected')
  assert.equal(result.rejectedBy, 'f')
  assert.equal(f.records.get('diwali_stock')[0].available, 3)
  assert.equal(f.records.get('diwali_stock')[0].reserved, 0)
  assert.equal(f.records.get('diwali_messages')[0].status, 'suppressed')
})

test('verifiers cannot reject approved fulfilment and delivered gifts cannot be rejected', async () => {
  const f = fixture({ status: 'approved', stage: 'packed' })
  await assert.rejects(f.service.actOnClaim(staff('v'), 'claim', { action: 'reject', version: 0, note: 'Review issue' }), /permission/)
  const delivered = fixture({ status: 'approved', stage: 'delivered' })
  await assert.rejects(delivered.service.actOnClaim(staff('f'), 'claim', { action: 'reject', version: 0, note: 'Review issue' }), /Delivered/)
})
