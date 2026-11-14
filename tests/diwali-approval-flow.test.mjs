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
    staff: [{ userId: 'full', role: 'full_access', stores: [], export: true }, { userId: 'f', role: 'fulfilment', stores: ['A'], export: false }, { userId: 'v', role: 'verifier', stores: ['A'], export: false }] }
  records.set('diwali_config', [{ _id: '2026', ...config }])
  records.set('diwali_claims', [{ _id: 'claim', reference: 'FIXTURE-CLAIM', name: 'Fixture customer', mobile: '9876543210', email: 'fixture@example.invalid', storeCode: 'A', invoice: 'FIXTURE-1',
    enteredValue: 26000, status, fulfilment: stage, version: 0, whatsappConsent: consent, language: 'en', giftCode: 'silver10', createdAt: new Date() }])
  records.set('diwali_stock', [{ _id: 'silver10', available: 2, reserved: 1, dispatched: 0 }])
  records.set('users', [{ _id: 'legacy-admin', name: 'Legacy Approver' }])
  let inTransaction = false, failAudit = false
  function matches(row, filter) {
    return Object.entries(filter).every(([key, value]) => {
      if (key === '$and') return value.every(part => matches(row, part))
      if (key === '$or') return value.some(part => matches(row, part))
      if (value && typeof value === 'object') {
        if ('$gt' in value) return row[key] > value.$gt
        if ('$exists' in value) return (row[key] !== undefined) === value.$exists
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
      find(filter) { const cursor = { sort() { return cursor }, skip() { return cursor }, limit() { return cursor }, async toArray() { return rows.filter(row => matches(row, filter)) } }; return cursor },
      async countDocuments(filter) { return rows.filter(row => matches(row, filter)).length },
      async insertOne(row) { if (name === 'diwali_audit' && failAudit) throw new Error('Synthetic audit failure'); rows.push(structuredClone(row)) },
      async updateOne(filter, update) { const row = rows.find(row => matches(row, filter)); if (!row) return { modifiedCount: 0 }; apply(row, update); return { modifiedCount: 1 } },
      async updateMany(filter, update) { rows.filter(row => matches(row, filter)).forEach(row => apply(row, update)) },
      async findOneAndUpdate(filter, update) { const row = rows.find(row => matches(row, filter)); if (!row) return null; apply(row, update); return structuredClone(row) },
    }
  }
  const loader = sourceLoader({
    '@/lib/auth': { requireUser: async () => ({ ok: true, user: admin }), requireFullAdmin: async () => ({ ok: true, user: admin }) },
    '@/lib/db-service': { getCollection: async name => collection(name), normalizeId: row => ({ ...row, id: row._id }) },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession: () => ({ async withTransaction(work) { inTransaction = true; const before = structuredClone(records); try { return await work() } catch (error) { records.clear(); for (const [name, rows] of before) records.set(name, rows); throw error } finally { inTransaction = false } }, async endSession() {} }) } }) },
    '@/lib/diwali/blocklist': { assertDiwaliCustomerAllowed: async () => {} },
  }, { env: { DIWALI_MESSAGING_ENABLED: 'true', ASKEVA_API_KEY: 'fixture-key', ASKEVA_API_URL: 'https://provider.fixture.invalid', DIWALI_APPROVED_TEMPLATE_EN: 'fixture_approval' },
    fetch: async (_url, options) => {
      assert.equal(inTransaction, false, 'Provider calls must happen after the transaction commits')
      calls.push(JSON.parse(options.body))
      if (provider === 'timeout') throw new Error('Synthetic timeout')
      return Response.json(provider === 'accepted' ? { messages: [{ id: 'fixture-message' }] } : {}, { status: provider === 'limited' ? 429 : 200 })
    },
  })
  return { loader, calls, records, service: loader.load('lib/diwali/service.ts'), failAudit() { failAudit = true } }
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

test('approving a rejected registration requires a reason and retains both decisions in exports and audit', async () => {
  const f = fixture({ consent: false })
  await f.service.actOnClaim(admin, 'claim', { action: 'reject', version: 0, note: 'Invoice could not be verified' })
  const action = { ...approval, version: 1, note: '' }
  await assert.rejects(f.service.actOnClaim(admin, 'claim', action), /reason/)
  await assert.rejects(f.service.actOnClaim(staff('f'), 'claim', { ...action, note: 'Store confirmed invoice' }), /permission/)
  const result = await f.service.actOnClaim(staff('v'), 'claim', { ...action, note: 'Store confirmed invoice' })
  assert.equal(result.status, 'approved')
  assert.equal(result.fulfilment, 'pending')
  assert.equal(result.rejectionReason, 'Invoice could not be verified')
  assert.equal(result.verificationNote, 'Store confirmed invoice')
  assert.equal(result.version, 2)
  const log = f.records.get('diwali_audit').find(row => row.action === 'approve')
  assert.equal(log.before.status, 'rejected')
  assert.equal(log.before.rejectionReason, 'Invoice could not be verified')
  assert.equal(log.input.note, 'Store confirmed invoice')
  const csv = await f.service.exportClaims(admin)
  assert.match(csv, /"verificationNote","rejectionReason"/)
  assert.match(csv, /Invoice could not be verified/)
  assert.match(csv, /Store confirmed invoice/)
  await assert.rejects(f.service.actOnClaim(admin, 'claim', { ...action, note: 'Stale approval' }), /updated/)
})

test('reapproval after packing releases no extra stock and sends no duplicate approval notification', async () => {
  const f = fixture()
  await f.service.actOnClaim(admin, 'claim', approval)
  await f.service.actOnClaim(admin, 'claim', { action: 'pack', version: 1 })
  await f.service.actOnClaim(admin, 'claim', { action: 'reject', version: 2, note: 'Invoice review needed' })
  const before = structuredClone(f.records.get('diwali_stock'))
  const result = await f.service.actOnClaim(admin, 'claim', { ...approval, version: 3, note: 'Invoice confirmed by store' })
  assert.equal(result.fulfilment, 'pending')
  assert.deepEqual(f.records.get('diwali_stock'), before)
  assert.equal(f.records.get('diwali_messages').filter(row => row.event === 'approved').length, 1)
  assert.equal(f.calls.length, 1)
})

test('reapproval preserves dispatched gifts and prevents changing a shipped gift slab', async () => {
  const f = fixture({ status: 'rejected', stage: 'rejected', consent: false })
  Object.assign(f.records.get('diwali_claims')[0], { previousFulfilment: 'dispatched', verifiedValue: 26000, rejectionReason: 'Review delivery' })
  await assert.rejects(f.service.actOnClaim(admin, 'claim', { ...approval, verifiedValue: 50001, note: 'Verified invoice' }), /dispatched gift/)
  const result = await f.service.actOnClaim(admin, 'claim', { ...approval, note: 'Verified invoice' })
  assert.equal(result.fulfilment, 'dispatched')
  assert.equal(result.rejectionReason, 'Review delivery')
})

test('reapproval rolls back when audit recording fails', async () => {
  const f = fixture({ status: 'rejected', consent: false })
  f.failAudit()
  await assert.rejects(f.service.actOnClaim(admin, 'claim', { ...approval, note: 'Verified invoice' }), /audit failure/)
  assert.equal(f.records.get('diwali_claims')[0].status, 'rejected')
  assert.equal(f.records.get('diwali_claims')[0].version, 0)
})

test('rejected registration approval form requires and submits the reversal reason', async () => {
  const state = [], calls = []
  let index = 0
  const claim = { id: 'claim', reference: 'FIXTURE-CLAIM', status: 'rejected', fulfilment: 'rejected', enteredValue: 26000, storeCode: 'A', city: 'Fixture city', version: 3, rejectionReason: 'Invoice unclear' }
  state[0] = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  state[1] = { role: 'verifier' }
  state[6] = claim
  const loader = sourceLoader({
    react: { useRef: initial => ({ current: initial }), useEffect() {}, useState(initial) { const current = index++; if (!(current in state)) state[current] = initial; return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value }] } },
    'next/navigation': { useRouter: () => ({}) },
    '@/lib/api-client': { apiFetch: async (url, options) => { calls.push({ url, options }); return Response.json(options.method === 'POST' ? { status: 'approved' } : { claim: { ...claim, status: 'approved' }, history: [] }) } },
  })
  const Component = loader.load('components/diwali/AdminGift.tsx').default
  const render = () => { index = 0; const nodes = []; function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; nodes.push(node); visit(node.props.children) } visit(Component({ section: 'detail', claimId: 'claim' })); return nodes }
  let nodes = render()
  const approve = () => nodes.find(node => node.type === 'button' && node.props.children === 'Approve rejected registration')
  assert.equal(approve().props.disabled, true)
  nodes.find(node => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value: '26000' } })
  nodes.find(node => node.type === 'input' && node.props.type === 'date').props.onChange({ target: { value: '2026-11-05' } })
  nodes.find(node => node.type === 'textarea').props.onChange({ target: { value: 'Store verified original invoice' } })
  nodes = render()
  assert.equal(approve().props.disabled, false)
  await approve().props.onClick()
  const payload = calls.find(call => call.options.method === 'POST').options.json
  assert.equal(payload.action, 'approve')
  assert.equal(payload.note, 'Store verified original invoice')
  assert.equal(payload.version, 3)
})

test('reports display both decision reasons and reload the rows when filters are applied', async () => {
  const state = [], calls = []
  let index = 0
  const report = { totals: { registrations: 1, verifiedValue: 26000 }, gifts: [], fulfilment: [], stores: [], messages: [], stock: [], approvalRate: null, slaCompliance: null, whatsappSuccessRate: null }
  state[0] = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  state[1] = { role: 'superadmin' }
  state[2] = report
  state[3] = [{ id: 'claim', reference: 'FIXTURE-CLAIM', status: 'approved', enteredValue: 26000, verificationNote: 'Invoice confirmed', rejectionReason: 'Invoice previously unclear' }]
  state[4] = 1
  const loader = sourceLoader({
    react: { useRef: initial => ({ current: initial }), useEffect() {}, useState(initial) { const current = index++; if (!(current in state)) state[current] = initial; return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value }] } },
    'next/navigation': { useRouter: () => ({}) },
    '@/lib/api-client': { apiFetch: async url => { calls.push(url); return Response.json(url.includes('/reports') ? report : { items: [], total: 0 }) } },
  })
  const nodes = []
  function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; nodes.push(node); visit(node.props.children) }
  visit(loader.load('components/diwali/AdminGift.tsx').default({ section: 'reports' }))
  for (const text of ['Approval reason', 'Rejection reason', 'Invoice confirmed', 'Invoice previously unclear']) assert.ok(nodes.some(node => node.props.children === text))
  nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} })
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(calls.some(url => url.includes('/reports?')))
  assert.ok(calls.some(url => url.includes('/registrations?page=1')))
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

test('approval shows the amount-based gift live, defaults to today and matched invoice, and needs a reason only for rejection', async () => {
  const state = [], effects = []
  let index = 0
  const config = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  const loader = sourceLoader({
    react: { useCallback: callback => callback, useRef: initial => ({ current: initial }),
      useEffect(callback) { effects.push(callback) },
      useState(initial) { const current = index++; if (!(current in state)) state[current] = initial; return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value }] },
    },
    'next/navigation': { useRouter: () => ({}) },
    '@/lib/api-client': { apiFetch: async url => Response.json(url.endsWith('/config') ? { config, access: { role: 'superadmin' } } : { claim: { id: 'claim', source: 'store', status: 'pending', enteredValue: 26000, city: 'Fixture city', createdAt: new Date().toISOString() }, history: [] }) },
  })
  const Component = loader.load('components/diwali/AdminGift.tsx').default
  Component({ section: 'detail', claimId: 'claim' })
  for (const effect of effects) await effect()
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
  assert.ok(nodes.some(node => node.type === 'dd' && node.props.children === '10 Gram Silver (pending approval)'))
  for (const [amount, gift] of [[15000, '5 Gram Silver'], [26000, '10 Gram Silver'], [50001, '15 Gram Silver'], [80001, '20 Gram Silver'], [100001, '1 Gram Gold'], [14999, null], ['', null], [25999.5, null]]) {
    nodes.find(node => node.type === 'input' && node.props.type === 'number').props.onChange({ target: { value: String(amount) } })
    index = 0; nodes.length = 0
    visit(Component({ section: 'detail', claimId: 'claim' }))
    assert.ok(nodes.some(node => node.type === 'dd' && node.props.children === (gift ? `${gift} (pending approval)` : 'No eligible gift')))
    const preview = nodes.find(node => node.props.role === 'status' && node.props.className?.includes('rounded-lg'))
    assert.equal(preview.props.children[0].props.children[1], gift || 'No eligible gift')
  }
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

test('administrator deletion removes the registration from listings and exports, releases packed stock and retains audit', async () => {
  const f = fixture({ status: 'approved', stage: 'packed' })
  f.records.set('diwali_messages', [{ _id: 'queued', claimId: 'claim', status: 'queued' }, { _id: 'accepted', claimId: 'claim', status: 'accepted' }])
  f.records.set('diwali_registration_emails', [{ _id: 'email', claimId: 'claim', status: 'queued' }])
  const result = await f.service.deleteClaim(admin, 'claim', 0)
  assert.equal(result.deleted, true)
  assert.equal(f.records.get('diwali_claims')[0].deletedBy, admin.id)
  assert.equal(Object.prototype.toString.call(f.records.get('diwali_claims')[0].deletedAt), '[object Date]')
  assert.equal(f.records.get('diwali_stock')[0].reserved, 0)
  assert.equal(f.records.get('diwali_stock')[0].available, 3)
  assert.equal(f.records.get('diwali_messages')[0].status, 'suppressed')
  assert.equal(f.records.get('diwali_messages')[1].status, 'accepted')
  assert.equal(f.records.get('diwali_registration_emails')[0].status, 'suppressed')
  assert.equal(f.records.get('diwali_audit')[0].action, 'delete')
  assert.equal((await f.service.listClaims(admin, new URLSearchParams())).total, 0)
  assert.doesNotMatch(await f.service.exportClaims(admin), /FIXTURE-CLAIM/)
  await assert.rejects(f.service.getClaim(admin, 'claim'), /not found/)
  await assert.doesNotReject(f.loader.load('lib/diwali/registration-identity.ts').assertNewDiwaliRegistration('9876543210'))
})

test('deletion checks administrator access, version and notifications in progress before changing the claim', async () => {
  const f = fixture()
  await assert.rejects(f.service.deleteClaim(staff('v'), 'claim', 0), /permission/)
  await assert.rejects(f.service.deleteClaim(admin, 'claim', 9), /updated/)
  f.records.set('diwali_messages', [{ _id: 'sending', claimId: 'claim', status: 'sending' }])
  await assert.rejects(f.service.deleteClaim(admin, 'claim', 0), /notification is being sent/)
  assert.equal(f.records.get('diwali_claims')[0].deletedAt, undefined)
})

test('deletion rolls back the claim, notification suppression and reserved stock if audit recording fails', async () => {
  const f = fixture({ status: 'approved', stage: 'packed' })
  f.records.set('diwali_messages', [{ _id: 'ready', claimId: 'claim', status: 'ready' }])
  f.failAudit()
  await assert.rejects(f.service.deleteClaim(admin, 'claim', 0), /audit failure/)
  assert.equal(f.records.get('diwali_claims')[0].deletedAt, undefined)
  assert.equal(f.records.get('diwali_claims')[0].version, 0)
  assert.equal(f.records.get('diwali_stock')[0].available, 2)
  assert.equal(f.records.get('diwali_stock')[0].reserved, 1)
  assert.equal(f.records.get('diwali_messages')[0].status, 'ready')
})

test('deleting dispatched registrations does not return shipped gifts to available stock', async () => {
  const f = fixture({ status: 'approved', stage: 'dispatched' })
  f.records.set('diwali_stock', [{ _id: 'silver10', available: 2, reserved: 0, dispatched: 1 }])
  await f.service.deleteClaim(admin, 'claim', 0)
  assert.equal(f.records.get('diwali_stock')[0].available, 2)
  assert.equal(f.records.get('diwali_stock')[0].dispatched, 1)
})

test('DELETE API verifies origin, authenticated credentials, strict input and session-derived actor', async () => {
  let checks = 0, deletes = 0, actor
  let allowed = false
  const route = sourceLoader({
    '@/lib/auth': { requireUser: async () => { checks++; return allowed ? { ok: true, user: admin } : { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) } } },
    '@/lib/diwali/service': { deleteClaim: async (user, id, version) => { actor = user.id; deletes++; assert.equal(id, 'claim'); assert.equal(version, 3); return { deleted: true } } },
  }).load('app/api/admin/diwali/registrations/[id]/route.ts')
  const context = { params: Promise.resolve({ id: 'claim' }) }
  const request = (body, origin = 'https://sara.test') => new Request('https://sara.test/api/admin/diwali/registrations/claim', { method: 'DELETE', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await route.DELETE(request({ version: 3 }, 'https://attacker.test'), context)).status, 403)
  assert.equal(checks, 0)
  assert.equal((await route.DELETE(request({ version: 3 }), context)).status, 403)
  allowed = true
  assert.equal((await route.DELETE(request({ version: 3, deletedBy: 'forged' }), context)).status, 400)
  assert.equal(deletes, 0)
  const response = await route.DELETE(request({ version: 3 }), context)
  assert.equal(response.status, 200)
  assert.equal(actor, admin.id)
  assert.match(response.headers.get('cache-control'), /private.*no-store/)
})

test('registration Delete button confirms the target, sends its version and refreshes the list', async () => {
  const state = [], calls = []
  let index = 0, confirmed = false
  state[0] = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  state[1] = { role: 'superadmin', export: true }
  state[3] = [{ id: 'claim', reference: 'FIXTURE-CLAIM', enteredValue: 26000, createdAt: new Date().toISOString(), version: 3, status: 'pending' }]
  state[4] = 1
  const loader = sourceLoader({
    react: { useCallback: callback => callback, useRef: initial => ({ current: initial }), useEffect() {}, useState(initial) { const current = index++; if (!(current in state)) state[current] = initial; return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value }] } },
    'next/navigation': { useRouter: () => ({}) },
    '@/lib/api-client': { apiFetch: async (url, options) => { calls.push({ url, options }); return Response.json(options.method === 'DELETE' ? { deleted: true } : { items: [], total: 0 }) } },
  }, { context: { window: { confirm(text) { assert.match(text, /FIXTURE-CLAIM/); return confirmed } } } })
  const Component = loader.load('components/diwali/AdminGift.tsx').default
  const render = () => { index = 0; const nodes = []; function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; nodes.push(node); visit(node.props.children) } visit(Component({ section: 'registrations' })); return nodes }
  const button = render().find(node => node.type === 'button' && node.props.children === 'Delete')
  await button.props.onClick()
  assert.equal(calls.length, 0)
  confirmed = true
  await button.props.onClick()
  assert.equal(calls[0].options.method, 'DELETE')
  assert.equal(calls[0].options.json.version, 3)
  assert.match(calls[1].url, /registrations\?page=1/)
  assert.equal(render().some(node => node.type === 'button' && node.props.children === 'Delete'), false)
  state[1] = { role: 'verifier' }; state[3] = [{ id: 'claim', enteredValue: 26000 }]
  assert.equal(render().some(node => node.type === 'button' && node.props.children === 'Delete'), false)
})


test('full campaign staff can delete registrations with the same audited stock release as administrators', async () => {
  const f = fixture({ status: 'approved', stage: 'packed' })
  const user = { id: 'full', role: 'user', dashboardAccess: true, allowedPages: ['/admin/diwali'] }
  await f.service.deleteClaim(user, 'claim', 0)
  assert.equal(f.records.get('diwali_claims')[0].deletedBy, 'full')
  assert.equal(f.records.get('diwali_stock')[0].reserved, 0)
  assert.equal(f.records.get('diwali_audit').some(row => row.action === 'delete' && row.actor === 'full'), true)
})
