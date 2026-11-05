import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, randomUUID } from 'node:crypto'
import { sourceLoader } from './source-loader.mjs'

function fixture(notificationSettings = null, failQueue = false) {
  let rows = [], reservations = new Map(), queue = Promise.resolve()
  const sent = [], writes = [], tokens = new Map()
  const defaults = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  const config = { ...defaults, enabled: true, rulesConfirmed: true, calendarConfirmed: true,
    campaignStart: '2000-01-01', campaignEnd: '2099-12-31', registrationStart: '2000-01-01', registrationEnd: '2099-12-31',
    termsEn: 'Approved', termsKn: 'Approved', privacyEn: 'Approved', privacyKn: 'Approved', stores: [{ code: 'A', name: 'Fixture store' }] }
  const loader = sourceLoader({
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession() { return {
      async withTransaction(work) {
        const previous = queue; let release; queue = new Promise(resolve => { release = resolve }); await previous
        const before = structuredClone([rows, reservations]), size = writes.length
        try { return await work() } catch (error) { [rows, reservations] = before; writes.splice(size); throw error } finally { release() }
      }, async endSession() {},
    } } } }) },
    '@/lib/db-service': { getCollection: async name => ({
      async createIndexes() {}, async createIndex() {},
      async findOne(query) {
        if (name === 'diwali_config') return { _id: '2026', ...config }
        if (name === 'diwali_sessions') return tokens.get(query._id) || null
        if (name === 'diwali_notification_settings') return notificationSettings
        if (name === 'diwali_registration_identities') return reservations.get(query._id) || null
        if (name !== 'diwali_claims') return null
        return rows.find(row => {
          if (query.deletedAt && (row.deletedAt !== undefined) !== query.deletedAt.$exists) return false
          if (query.$or) return query.$or.some(match => match.mobile ? row.mobile === match.mobile : new RegExp(match.email.$regex, match.email.$options).test(row.email || ''))
          if (query._id) return row._id === query._id
          return row.requestKey === query.requestKey && row.mobile === query.mobile
        }) || null
      },
      async insertOne(row, options) {
        if (name === 'diwali_registration_emails' && failQueue) throw new Error('Synthetic email queue failure')
        if (name === 'diwali_registration_identities') {
          if (reservations.has(row._id)) throw Object.assign(new Error('Duplicate identity'), { code: 11000, keyValue: { _id: row._id } })
          reservations.set(row._id, row)
        }
        if (name === 'diwali_claims') rows.push(row)
        writes.push({ name, row, options })
      }, async updateOne() {}, async deleteOne(query) {
        const row = reservations.get(query._id)
        if (name === 'diwali_registration_identities' && row?.claimId === query.claimId) { reservations.delete(query._id); return { deletedCount: 1 } }
        return { deletedCount: 0 }
      },
    }) },
    '@/lib/whatsapp-template': { sendWhatsAppTemplate: async () => { sent.push(true); return { success: true } } },
    '@/lib/diwali/immediate-messages': { sendImmediateDiwaliMessage: async key => { sent.push(key); return 'accepted' } },
  }, { env: { DIWALI_MESSAGING_ENABLED: 'true', DIWALI_OTP_TEMPLATE: 'synthetic-auth' } })
  return { service: loader.load('lib/diwali/service.ts'), loader, sent, writes, rows: () => rows, reservations: () => new Map(reservations),
    token(mobile) { const token = randomUUID(); tokens.set(createHash('sha256').update(token).digest('hex'), { mobile, verifiedAt: new Date() }); return token },
    seed(row) { rows.push(row) },
    input(email = 'shopper@example.com') { return loader.load('lib/diwali/schemas.ts').RegistrationSchema.parse({ requestId: randomUUID(), name: 'Synthetic customer', email, address: 'Synthetic Street 123', city: 'Bengaluru', state: 'Bengaluru', pincode: '560001', storeCode: 'A', invoice: randomUUID(), enteredValue: 26000, language: 'en', accuracy: true, whatsappConsent: false, consentVersion: config.consentVersion }) },
  }
}

test('same mobile with another email and same email with another mobile cannot register again', async () => {
  const f = fixture(), first = f.token('9876543210')
  await f.service.register(first, f.input())
  for (const [token, email] of [[first, 'other@example.com'], [f.token('9123456789'), ' SHOPPER@EXAMPLE.COM ']]) {
    await assert.rejects(f.service.register(token, f.input(email)), error => error.status === 409 && /already has a Diwali registration/.test(error.message))
  }
  assert.equal(f.rows().length, 1)
})

test('simultaneous registrations with either shared identifier produce one claim', async () => {
  for (const shared of ['mobile', 'email']) {
    const f = fixture(), first = f.token('9876543210'), second = shared === 'mobile' ? first : f.token('9123456789')
    const results = await Promise.allSettled([f.service.register(first, f.input()), f.service.register(second, f.input(shared === 'email' ? 'SHOPPER@example.com' : 'other@example.com'))])
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(results.find(result => result.status === 'rejected').reason.status, 409)
    assert.equal(f.rows().length, 1)
  }
})

test('retrying the same request returns its saved reference without creating another claim', async () => {
  const f = fixture(), token = f.token('9876543210'), input = f.input()
  const results = await Promise.all([f.service.register(token, input), f.service.register(token, input)])
  assert.equal(results[0].reference, results[1].reference)
  assert.equal(f.rows().length, 1)
  assert.ok(f.writes.every(write => write.options.session))
})

test('consenting registration records a confirmation and sends immediately after commit only once', async () => {
  const f = fixture(), token = f.token('9876543210'), input = { ...f.input(), whatsappConsent: true }
  const first = await f.service.register(token, input)
  assert.equal(first.whatsappStatus, 'accepted')
  assert.equal(f.sent.length, 1)
  assert.match(f.sent[0], /:registered$/)
  const message = f.writes.find(write => write.name === 'diwali_messages')
  assert.equal(message.row.event, 'registered')
  assert.equal(message.row.status, 'ready')
  assert.deepEqual(Array.from(message.row.values), [input.name, first.reference, f.rows()[0].invoice])
  const repeated = await f.service.register(token, input)
  assert.equal(repeated.reference, first.reference)
  assert.equal(f.sent.length, 1)
})

test('historical rejected and online claims also prevent repeat form registrations', async () => {
  for (const row of [{ mobile: '9876543210', status: 'rejected' }, { email: 'SHOPPER@EXAMPLE.COM', source: 'online' }]) {
    const f = fixture(); f.seed(row)
    await assert.rejects(f.service.register(f.token('9876543210'), f.input()), /already has a Diwali registration/)
    assert.equal(f.writes.length, 0)
  }
})

test('repeat registration OTPs are rejected without a message; status OTPs remain available', async () => {
  const f = fixture(); f.seed({ mobile: '9876543210', email: 'shopper@example.com' })
  await assert.rejects(f.service.sendOtp('9876543210', 'en', 'register', 'other@example.com'), /already has a Diwali registration/)
  await assert.rejects(f.service.sendOtp('9123456789', 'en', 'register', 'shopper@example.com'), /already has a Diwali registration/)
  assert.equal(f.sent.length, 0)
  await f.service.sendOtp('9876543210', 'en', 'status')
  assert.equal(f.sent.length, 1)
})

test('unique identity reservations reject racing writes even before a claim is visible', async () => {
  const f = fixture(), { reserveDiwaliRegistrationIdentity } = f.loader.load('lib/diwali/registration-identity.ts')
  const results = await Promise.allSettled([reserveDiwaliRegistrationIdentity('first', '9876543210', undefined, {}), reserveDiwaliRegistrationIdentity('second', '+91 9876543210', undefined, {})])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 11000)
})

test('one email per selected employee is queued atomically and request retries add no extra email', async () => {
  const f = fixture({ enabled: true, recipients: ['first@example.com', 'second@example.com'] })
  const token = f.token('9876543210'), input = f.input()
  await f.service.register(token, input)
  await f.service.register(token, input)
  const emails = f.writes.filter(write => write.name === 'diwali_registration_emails')
  assert.equal(emails.length, 2)
  assert.deepEqual(emails.map(write => write.row.recipient), ['first@example.com', 'second@example.com'])
  assert.ok(emails.every(write => write.options.session && write.row.status === 'queued'))
})

test('a queue persistence failure rolls back the claim and identities so the same form can be retried', async () => {
  const f = fixture({ enabled: true, recipients: ['first@example.com'] }, true)
  await assert.rejects(f.service.register(f.token('9876543210'), f.input()), /email queue failure/)
  assert.equal(f.rows().length, 0)
  assert.equal(f.writes.length, 0)
})


test('database-checked identities register without an OTP and do not gain mobile ownership or status access', async () => {
  const f = fixture(), input = { ...f.input(), mobile: '9876543210' }
  const receipt = await f.service.checkRegistrationDetails({ mobile: input.mobile, email: input.email })
  const saved = await f.service.register(undefined, input, undefined, receipt)
  assert.ok(saved.reference)
  assert.equal(f.rows()[0].mobile, input.mobile)
  assert.equal(f.rows()[0].verifiedMobileAt, undefined)
  assert.ok(f.rows()[0].registrationCheckAt)
  await assert.rejects(f.service.customerSession(receipt), error => error.status === 401)
  await assert.rejects(f.service.checkRegistrationDetails({ mobile: input.mobile, email: 'other@example.com' }), /This number or email ID is already used/)
  await assert.rejects(f.service.checkRegistrationDetails({ mobile: '9123456789', email: input.email }), /This number or email ID is already used/)
  assert.equal((await f.service.register(undefined, input, undefined, receipt)).reference, saved.reference)
})

test('a successful database check cannot bypass duplicate checks at submission or racing reservations', async () => {
  const f = fixture()
  const first = { ...f.input(), mobile: '9876543210' }, second = { ...f.input('other@example.com'), mobile: first.mobile }
  const firstCheck = await f.service.checkRegistrationDetails({ mobile: first.mobile, email: first.email })
  const secondCheck = await f.service.checkRegistrationDetails({ mobile: second.mobile, email: second.email })
  const results = await Promise.allSettled([f.service.register(undefined, first, undefined, firstCheck), f.service.register(undefined, second, undefined, secondCheck)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409)
  assert.equal(f.rows().length, 1)
})


test('phone-only registrations allow missing email without sharing an empty-email reservation', async () => {
  const f = fixture()
  for (const mobile of ['9876543210', '9123456789']) {
    const input = { ...f.input(''), mobile }
    const identity = f.loader.load('lib/diwali/registration-check.ts').RegistrationCheckSchema.parse({ mobile })
    const receipt = await f.service.checkRegistrationDetails(identity)
    await f.service.register(undefined, input, undefined, receipt)
  }
  assert.equal(f.rows().length, 2)
  assert.ok(f.rows().every(row => row.email === ''))
  assert.equal(f.reservations().size, 2)
  assert.ok([...f.reservations().keys()].every(key => key.startsWith('2026:mobile:')))
})

test('deleted registrations no longer block Verify and their old identity reservations are reclaimed at submission', async () => {
  const f = fixture(), old = 'synthetic-deleted', input = { ...f.input(), mobile: '9876543210' }
  f.seed({ _id: old, mobile: input.mobile, email: input.email, status: 'approved', deletedAt: new Date() })
  await f.loader.load('lib/diwali/registration-identity.ts').reserveDiwaliRegistrationIdentity(old, input.mobile, input.email, {})
  const receipt = await f.service.checkRegistrationDetails({ mobile: input.mobile, email: input.email })
  await f.service.register(undefined, input, undefined, receipt)
  const active = f.rows().filter(row => !row.deletedAt)
  assert.equal(active.length, 1)
  assert.ok([...f.reservations().values()].every(row => row.claimId === active[0]._id))
  assert.ok(f.rows().find(row => row._id === old).deletedAt)
  await assert.rejects(f.service.checkRegistrationDetails({ mobile: input.mobile, email: input.email }), /already used/)
})

test('reclaiming deleted identity reservations rolls back if registration persistence fails', async () => {
  const f = fixture({ enabled: true, recipients: ['first@example.com'] }, true), old = 'synthetic-deleted'
  const input = { ...f.input(), mobile: '9876543210' }
  f.seed({ _id: old, mobile: input.mobile, email: input.email, deletedAt: new Date() })
  await f.loader.load('lib/diwali/registration-identity.ts').reserveDiwaliRegistrationIdentity(old, input.mobile, input.email, {})
  const receipt = await f.service.checkRegistrationDetails({ mobile: input.mobile, email: input.email })
  await assert.rejects(f.service.register(undefined, input, undefined, receipt), /email queue failure/)
  assert.equal(f.rows().filter(row => !row.deletedAt).length, 0)
  assert.ok([...f.reservations().values()].every(row => row.claimId === old))
})
