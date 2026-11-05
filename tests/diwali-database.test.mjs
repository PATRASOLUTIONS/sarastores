import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { MongoClient } from 'mongodb'
import { sourceLoader } from './source-loader.mjs'

// Opt-in integration uses only DIWALI_TEST_MONGODB_URI and a fresh synthetic database.
test('Diwali transactional integration on an isolated synthetic MongoDB database', { skip: !process.env.DIWALI_TEST_DATABASE || !process.env.DIWALI_TEST_MONGODB_URI, timeout: 120000 }, async t => {
  const prefix = process.env.DIWALI_TEST_DATABASE
  assert.match(prefix, /^sara_diwali_isolated_test_[a-zA-Z0-9_]+$/)
  assert.ok(process.env.DIWALI_TEST_MONGODB_URI, 'Supply a dedicated isolated test-cluster URI through DIWALI_TEST_MONGODB_URI')
  // This Atlas tier limits database names to 38 bytes.
  const databaseName = `${prefix}_${randomUUID().replaceAll('-', '').slice(0, 6)}`
  const client = new MongoClient(process.env.DIWALI_TEST_MONGODB_URI, { serverSelectionTimeoutMS: 10000, maxPoolSize: 4 })
  try { await client.connect() } catch { await client.close(); throw new Error('Isolated test cluster connection failed; check network and Atlas access') }
  const db = client.db(databaseName)
  const normalizeId = document => { const { _id, id, ...rest } = document; return { ...rest, id: String(_id) } }
  let lastOtp = '', providerSequence = 0, providerMode = 'accepted'
  const loader = sourceLoader({
    '@/lib/auth': { requireUser: async () => ({ ok: true, user: admin }) },
    '@/lib/db-service': { getCollection: async name => db.collection(name), normalizeId },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client, db }) },
    '@/lib/whatsapp-template': { sendWhatsAppTemplate: async (_mobile, template) => { lastOtp = template.components[0].parameters[0].text; return { success: true, data: { messaging_product: 'whatsapp', messages: [{ id: randomUUID() }] } } } },
  }, { env: { DIWALI_MESSAGING_ENABLED: 'true', ASKEVA_API_KEY: 'synthetic-key', ASKEVA_API_URL: 'https://provider.fixture.invalid', DIWALI_OTP_TEMPLATE: 'test_auth', DIWALI_APPROVED_TEMPLATE_EN: 'test_approved_en', DIWALI_APPROVED_TEMPLATE_KN: 'test_approved_kn', DIWALI_DISPATCH_TEMPLATE_EN: 'test_dispatch_en', DIWALI_DISPATCH_TEMPLATE_KN: 'test_dispatch_kn' },
    fetch: async () => { if (providerMode === 'timeout') throw new Error('Synthetic timeout'); providerSequence++; return new Response(JSON.stringify({ messages: [{ id: `synthetic-provider-${providerSequence}` }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }) },
  })
  const service = loader.load('lib/diwali/service.ts'), messages = loader.load('lib/diwali/messages.ts')
  const { ConfigSchema, RegistrationSchema, ActionSchema, DEFAULT_CONFIG } = loader.load('lib/diwali/schemas.ts')
  const admin = { id: 'synthetic-admin', role: 'admin', name: 'Test administrator' }
  const verifier = { id: 'synthetic-verifier', role: 'user', dashboardAccess: true }
  const fulfilment = { id: 'synthetic-fulfilment', role: 'user', dashboardAccess: true }
  const manager = { id: 'synthetic-manager', role: 'user', dashboardAccess: true }
  let claimId, token, payload
  const config = { ...DEFAULT_CONFIG, enabled: true, rulesConfirmed: true, calendarConfirmed: true, registrationStart: '2000-01-01', registrationEnd: '2099-12-31',
    termsEn: 'Synthetic test campaign terms', termsKn: 'ಪರೀಕ್ಷಾ ನಿಯಮಗಳು', privacyEn: 'Synthetic test privacy notice', privacyKn: 'ಪರೀಕ್ಷಾ ಗೌಪ್ಯತೆ ಸೂಚನೆ', stores: [{ code: 'TEST-A', name: 'Synthetic store A' }, { code: 'TEST-B', name: 'Synthetic store B' }],
    staff: [{ userId: verifier.id, role: 'verifier', export: false, stores: ['TEST-A'] }, { userId: fulfilment.id, role: 'fulfilment', export: false, stores: ['TEST-A'] }, { userId: manager.id, role: 'management', export: false, stores: ['TEST-A'] }] }
  try {
    await t.test('configuration and indexes are created only in the new test database', async () => {
      await service.saveConfig(admin, ConfigSchema.parse(config))
      assert.equal((await service.getConfig()).enabled, true)
      assert.ok((await db.collection(service.COLLECTIONS.claims).indexes()).some(index => index.unique && index.key.invoiceKey))
    })
    await t.test('OTP is single-use, wrong attempts persist, and mobile session is server-issued', async () => {
      const challenge = await service.sendOtp('9000000001', 'en')
      assert.equal((await service.verifyOtp(challenge, '000000')).ok, false)
      assert.equal((await db.collection(service.COLLECTIONS.otp).findOne({ _id: challenge })).attempts, 1)
      const verified = await service.verifyOtp(challenge, lastOtp)
      assert.equal(verified.ok, true); token = verified.token
      assert.equal((await service.customerSession(token)).mobile, '9000000001')
      await assert.rejects(service.verifyOtp(challenge, lastOtp), /expired|attempts/)
      const locked = await service.sendOtp('9000000002', 'kn')
      const correct = lastOtp
      for (let attempt = 0; attempt < 5; attempt++) assert.equal((await service.verifyOtp(locked, '000000')).ok, false)
      await assert.rejects(service.verifyOtp(locked, correct), /expired|attempts/)
    })
    await t.test('registration is persistent, idempotent, and duplicate invoice races produce one claim', async () => {
      payload = RegistrationSchema.parse({ requestId: randomUUID(), name: 'Synthetic customer', email: 'synthetic@example.invalid', address: 'Synthetic address 123', city: 'Test city', state: 'Test district', pincode: '560001', storeCode: 'TEST-A', invoice: ' test / 001 ', enteredValue: 55000, language: 'en', accuracy: true, whatsappConsent: true, consentVersion: config.consentVersion })
      await assert.rejects(service.register(undefined, payload), /Verify your mobile/)
      const first = await service.register(token, payload), second = await service.register(token, payload)
      assert.equal(first.reference, second.reference)
      const claim = await db.collection(service.COLLECTIONS.claims).findOne({ reference: first.reference }); claimId = claim._id
      assert.equal(claim.mobile, '9000000001'); assert.equal(claim.invoice, 'TEST/001'); assert.equal(claim.status, 'pending')
      await assert.rejects(service.register(token, { ...payload, requestId: randomUUID() }), /already has a Diwali registration/)
      const raceTokens = []
      for (const mobile of ['9000000003', '9000000004']) {
        const challenge = await service.sendOtp(mobile, 'en')
        raceTokens.push((await service.verifyOtp(challenge, lastOtp)).token)
      }
      const concurrent = await Promise.allSettled(raceTokens.map((raceToken, index) => service.register(raceToken, { ...payload, email: `race-${index}@example.invalid`, invoice: 'RACE-001', requestId: randomUUID() })))
      assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1)
      assert.equal(await db.collection(service.COLLECTIONS.claims).countDocuments({ invoice: 'RACE-001' }), 1)
      assert.equal(await db.collection(service.COLLECTIONS.messages).countDocuments({ claimId, event: 'registered' }), 1)
    })
    const approval = { action: 'approve', version: 0, verifiedValue: 26000, invoiceDate: '2026-11-05', storeCode: 'TEST-A', note: 'Synthetic POS verification', invoiceValid: true, notRefunded: true }
    await t.test('store filters cannot broaden staff access and pending corrections preserve unique invoices', async () => {
      const challenge = await service.sendOtp('9000000005', 'en')
      const correctionToken = (await service.verifyOtp(challenge, lastOtp)).token
      const registered = await service.register(correctionToken, { ...payload, email: 'correction@example.invalid', requestId: randomUUID(), invoice: 'CORRECTION-001', whatsappConsent: false })
      const original = await db.collection(service.COLLECTIONS.claims).findOne({ reference: registered.reference })
      await assert.rejects(service.actOnClaim(verifier, original._id, ActionSchema.parse({ action: 'correct', version: 0, invoice: 'CORRECTION-002', storeCode: 'TEST-B', note: 'Synthetic store correction' })), /permission/)
      await assert.rejects(service.actOnClaim(admin, original._id, ActionSchema.parse({ action: 'correct', version: 0, invoice: 'TEST/001', storeCode: 'TEST-A', note: 'Synthetic duplicate correction' })))
      assert.equal((await db.collection(service.COLLECTIONS.claims).findOne({ _id: original._id })).version, 0)
      await service.actOnClaim(admin, original._id, ActionSchema.parse({ action: 'correct', version: 0, invoice: 'CORRECTION-002', storeCode: 'TEST-B', note: 'Synthetic corrected invoice store' }))
      assert.equal((await service.listClaims(verifier, new URLSearchParams({ storeCode: 'TEST-B' }))).total, 0)
      await assert.rejects(service.getClaim(verifier, original._id), /not found/)
      const log = await db.collection(service.COLLECTIONS.audit).findOne({ claimId: original._id, action: 'correct' })
      assert.equal(log.before.storeCode, 'TEST-A'); assert.equal(log.after.storeCode, 'TEST-B')
    })
    await t.test('permissions and invalid invoice dates block approval', async () => {
      await assert.rejects(service.actOnClaim(manager, claimId, ActionSchema.parse(approval)), /permission/)
      await assert.rejects(service.actOnClaim(verifier, claimId, ActionSchema.parse({ ...approval, invoiceDate: '2026-11-04' })), /outside/)
      await assert.rejects(service.actOnClaim(verifier, claimId, ActionSchema.parse({ ...approval, storeCode: 'TEST-B' })), /store/)
    })
    await t.test('simultaneous approvals allocate the verified slab and one notification event', async () => {
      const outcomes = await Promise.allSettled([service.actOnClaim(verifier, claimId, ActionSchema.parse(approval)), service.actOnClaim(verifier, claimId, ActionSchema.parse(approval))])
      assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1)
      const claim = await db.collection(service.COLLECTIONS.claims).findOne({ _id: claimId })
      assert.equal(claim.giftCode, 'silver10'); assert.equal(claim.verifiedValue, 26000); assert.equal(claim.version, 1)
      assert.ok(claim.dueAt instanceof Date)
      assert.equal(await db.collection(service.COLLECTIONS.messages).countDocuments({ claimId, event: 'approved' }), 1)
      assert.equal(await db.collection(service.COLLECTIONS.audit).countDocuments({ claimId, action: 'approve' }), 1)
    })
    await t.test('stock shortage, state ordering and staff permissions protect dispatch', async () => {
      await assert.rejects(service.actOnClaim(verifier, claimId, ActionSchema.parse({ action: 'pack', version: 1 })), /permission/)
      await assert.rejects(service.actOnClaim(fulfilment, claimId, ActionSchema.parse({ action: 'pack', version: 1 })), /Insufficient/)
      await assert.rejects(service.actOnClaim(fulfilment, claimId, ActionSchema.parse({ action: 'deliver', version: 1, proof: 'Synthetic proof' })), /Dispatch/)
      await service.addStock(admin, 'silver10', 2, 'Synthetic stock receipt')
      await service.actOnClaim(fulfilment, claimId, ActionSchema.parse({ action: 'pack', version: 1 }))
      await service.actOnClaim(fulfilment, claimId, ActionSchema.parse({ action: 'exception', version: 2, note: 'Synthetic address issue', nextAction: 'Call synthetic customer' }))
      await service.actOnClaim(fulfilment, claimId, ActionSchema.parse({ action: 'resume', version: 3, note: 'Synthetic issue resolved' }))
      await service.actOnClaim(fulfilment, claimId, ActionSchema.parse({ action: 'dispatch', version: 4, courier: 'Synthetic courier', awb: 'TEST-AWB-001', trackingUrl: 'https://courier.fixture.invalid/TEST-AWB-001' }))
      assert.equal(await db.collection(service.COLLECTIONS.messages).countDocuments({ claimId }), 3)
      await service.actOnClaim(fulfilment, claimId, ActionSchema.parse({ action: 'deliver', version: 5, proof: 'Synthetic proof reference' }))
      const stock = await db.collection(service.COLLECTIONS.stock).findOne({ _id: 'silver10' })
      assert.equal(stock.available, 1); assert.equal(stock.reserved, 0); assert.equal(stock.dispatched, 1)
    })
    await t.test('customer status exposes only owned summaries and management cannot export PII', async () => {
      const owned = await service.customerClaims(token)
      assert.equal(owned.find(row => row.reference === (payload.reference || owned[owned.length - 1].reference))?.name, undefined)
      const view = await service.listClaims(manager, new URLSearchParams())
      assert.equal(view.items[0].mobile, undefined); assert.equal(view.items[0].address, undefined)
      await assert.rejects(service.getClaim(manager, claimId), /restricted/)
      await assert.rejects(service.exportClaims(manager), /permission/)
      const report = await service.reports(admin, new URLSearchParams())
      assert.equal(report.totals.approved, 1); assert.equal(report.totals.verifiedValue, 26000)
      assert.equal((await service.reports(verifier, new URLSearchParams({ storeCode: 'TEST-B' }))).totals.registrations, 0)
      assert.match(await service.exportClaims(admin), /TEST\/001/)
    })
    await t.test('authorized report API produces CSV and a valid Excel workbook', async () => {
      const { GET } = loader.load('app/api/admin/diwali/reports/route.ts')
      const csv = await GET(new Request('https://fixture.invalid/api/admin/diwali/reports?format=csv&storeCode=TEST-A'))
      assert.equal(csv.status, 200); assert.match(await csv.text(), /TEST\/001/)
      const excel = await GET(new Request('https://fixture.invalid/api/admin/diwali/reports?format=xlsx&storeCode=TEST-A'))
      assert.equal(excel.status, 200)
      assert.match(excel.headers.get('content-type'), /spreadsheetml/)
      const bytes = new Uint8Array(await excel.arrayBuffer())
      assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b)
    })
    await t.test('provider calls are mocked, callbacks are monotonic, and ambiguous sends never auto-repeat', async () => {
      await messages.processMessages()
      assert.equal(providerSequence, 2)
      const row = await db.collection(service.COLLECTIONS.messages).findOne({ claimId, event: 'approved' })
      await messages.recordProviderStatus(row.providerId, 'delivered')
      await messages.recordProviderStatus(row.providerId, 'sent')
      assert.equal((await db.collection(service.COLLECTIONS.messages).findOne({ _id: row._id })).status, 'delivered')
      assert.equal((await service.reports(admin, new URLSearchParams())).whatsappSuccessRate, 0.5)
      await messages.recordProviderStatus('synthetic-early-callback', 'read')
      await messages.recordProviderStatus('synthetic-early-callback', 'sent')
      const receipt = await db.collection(service.COLLECTIONS.receipts).findOne({ _id: 'synthetic-early-callback' })
      assert.equal(receipt.status, 'read')
      const race = await db.collection(service.COLLECTIONS.claims).findOne({ invoice: 'RACE-001' })
      providerMode = 'timeout'
      await service.actOnClaim(admin, race._id, ActionSchema.parse(approval))
      const ambiguous = await db.collection(service.COLLECTIONS.messages).findOne({ claimId: race._id, event: 'approved' })
      assert.equal(ambiguous.status, 'unknown')
      assert.equal((await messages.processMessages()).processed, 0)
      await assert.rejects(messages.retryMessage(admin, ambiguous._id, 'Synthetic reason', false), /Confirm/)
      providerMode = 'accepted'
      await messages.retryMessage(admin, ambiguous._id, 'Provider confirmed no send', true)
      assert.equal((await db.collection(service.COLLECTIONS.messages).findOne({ _id: ambiguous._id })).status, 'accepted')
    })
    await t.test('status OTP remains available after registration closes', async () => {
      await service.saveConfig(admin, ConfigSchema.parse({ ...config, enabled: false }))
      await assert.rejects(service.sendOtp('9000000001', 'en', 'register'), /closed/)
      const challenge = await service.sendOtp('9000000001', 'en', 'status')
      assert.equal((await service.verifyOtp(challenge, lastOtp)).ok, true)
    })
    console.log('Database integration used a newly generated synthetic test database; no real messaging calls were made.')
  } finally {
    assert.equal(db.databaseName, databaseName)
    assert.ok(databaseName.startsWith(`${prefix}_`))
    try { await db.dropDatabase() } finally { await client.close() }
  }
})
