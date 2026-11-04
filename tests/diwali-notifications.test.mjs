import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

function fixture() {
  const config = { enabled: true, recipients: ['employee@example.com'] }, emails = [], sent = [], audits = []
  let outcome = { success: true, result: { accepted: ['employee@example.com'], rejected: [] } }, ready = true
  const claim = { _id: 'synthetic-claim', reference: 'SARA-DIW-DEMO', name: '<script>unsafe</script>', mobile: '9876543210', email: 'customer@example.com', invoice: '<fake-invoice>', storeCode: 'A', enteredValue: 26000, createdAt: new Date('2026-11-07') }
  const loader = sourceLoader({
    '@/lib/email': { storefrontOrigin: () => 'https://sarastores.com', sendEmail: async input => { sent.push(input); return outcome } },
    '@/lib/smtp': { getEmailTransport: () => { if (!ready) throw new Error('Synthetic SMTP configuration missing'); return {} } },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession: () => ({ withTransaction: async work => work(), endSession: async () => {} }) } }) },
    '@/lib/db-service': { normalizeId: ({ _id, ...rest }) => ({ id: _id, ...rest }), getCollection: async name => ({
      findOne: async () => name === 'diwali_notification_settings' ? config : name === 'diwali_claims' ? claim : null,
      insertOne: async row => { if (name === 'diwali_registration_emails') emails.push(row); else audits.push(row) },
      updateOne: async (filter, patch) => {
        if (name === 'diwali_notification_settings') Object.assign(config, patch.$set)
        else { const row = emails.find(item => item._id === filter._id && item.lock === filter.lock && item.status === filter.status); if (row) { Object.assign(row, patch.$set); for (const key of Object.keys(patch.$unset || {})) delete row[key] } }
      },
      findOneAndUpdate: async (filter, patch) => {
        const row = emails.find(item => item.status === filter.status && (!filter.reference || item.reference === filter.reference))
        if (!row) return null
        Object.assign(row, patch.$set); row.attempts += patch.$inc.attempts; return { ...row }
      },
      find: () => ({ sort() { return this }, limit() { return this }, toArray: async () => emails }),
      countDocuments: async filter => emails.filter(row => row.status === filter.status).length,
    }) },
  })
  return { loader, config, emails, sent, audits, claim, service: loader.load('lib/diwali/registration-notifications.ts'), outcome(value) { outcome = value }, ready(value) { ready = value } }
}

test('recipient settings require normalized unique emails, valid addresses and an enabled recipient', () => {
  const schema = sourceLoader().load('lib/diwali/notification-types.ts').NotificationSettingsSchema
  assert.deepEqual(schema.parse({ enabled: true, recipients: [' EMPLOYEE@example.com '] }).recipients, ['employee@example.com'])
  for (const value of [{ enabled: true, recipients: [] }, { enabled: true, recipients: ['invalid'] },
    { enabled: true, recipients: ['employee@example.com', 'EMPLOYEE@example.com'] }, { enabled: true, recipients: Array(11).fill('employee@example.com') },
    { enabled: false, recipients: [], actor: 'forged' }]) assert.equal(schema.safeParse(value).success, false)
})

test('employee mail escapes customer data and links to the authenticated claim review', () => {
  const f = fixture(), email = f.service.buildRegistrationEmployeeEmail(f.claim)
  assert.match(email.html, /&lt;script&gt;/)
  assert.doesNotMatch(email.html, /<script>/)
  assert.match(email.html, /https:\/\/sarastores.com\/admin\/diwali\/registrations\/synthetic-claim/)
  assert.match(email.text, /Pending invoice verification/)
  assert.match(email.text, /Mobile: 9876543210/)
})

test('each queued recipient is sent once and accepted status means mail-server acceptance', async () => {
  const f = fixture()
  await f.service.queueRegistrationEmails(f.claim, {})
  await Promise.all([f.service.processRegistrationEmails(f.claim.reference), f.service.processRegistrationEmails(f.claim.reference)])
  assert.equal(f.sent.length, 1)
  assert.equal(f.sent[0].to, 'employee@example.com')
  assert.equal(f.emails[0].status, 'accepted')
  await f.service.processRegistrationEmails(f.claim.reference)
  assert.equal(f.sent.length, 1)
})

test('SMTP rejection and uncertain timeout are recorded without retrying or touching the claim', async () => {
  for (const [outcome, expected] of [[{ success: false, error: { code: 'EAUTH' } }, 'failed'], [{ success: false, error: { code: 'ETIMEDOUT' } }, 'unknown'],
    [{ success: true, result: { accepted: [], rejected: ['employee@example.com'] } }, 'failed']]) {
    const f = fixture(); f.outcome(outcome)
    await f.service.queueRegistrationEmails(f.claim, {})
    await f.service.processRegistrationEmails()
    await f.service.processRegistrationEmails()
    assert.equal(f.emails[0].status, expected)
    assert.equal(f.sent.length, 1)
    assert.equal(f.claim.reference, 'SARA-DIW-DEMO')
  }
})

test('disabled notifications, missing SMTP and removed recipients prevent mail delivery', async () => {
  const f = fixture()
  await f.service.queueRegistrationEmails(f.claim, {})
  f.ready(false); await f.service.processRegistrationEmails()
  assert.equal(f.emails[0].status, 'queued')
  f.ready(true); f.config.enabled = false; await f.service.processRegistrationEmails()
  assert.equal(f.sent.length, 0)
  f.config.enabled = true; f.config.recipients = ['replacement@example.com']; await f.service.processRegistrationEmails()
  assert.equal(f.sent.length, 0)
})

test('settings cannot be enabled without SMTP and audit identity comes from the caller', async () => {
  const f = fixture(); f.ready(false)
  await assert.rejects(f.service.saveRegistrationNotifications('trusted-admin', { enabled: true, recipients: ['employee@example.com'] }), /SMTP_HOST/)
  f.ready(true); await f.service.saveRegistrationNotifications('trusted-admin', { enabled: true, recipients: ['employee@example.com'] })
  assert.equal(f.audits[0].actor, 'trusted-admin')
  assert.equal(f.audits[0].recipientCount, 1)
})

test('notification status counts all pending emails and exposes no customer contact or locking secrets', async () => {
  const f = fixture()
  await f.service.queueRegistrationEmails(f.claim, {})
  const response = await f.service.getRegistrationNotifications()
  assert.equal(response.pending, 1)
  assert.equal(response.emails[0].claimId, undefined)
  assert.equal(response.emails[0].mobile, undefined)
  assert.equal(response.emails[0].lock, undefined)
})

test('notification endpoint denies non-admins and cross-origin writes before performing any action', async () => {
  let allowed = false, calls = 0
  const api = sourceLoader({
    '@/lib/auth': { requireFullAdmin: async () => allowed ? { ok: true, user: { id: 'trusted-admin' } } : { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) } },
    '@/lib/diwali/registration-notifications': { getRegistrationNotifications: async () => { calls++ }, saveRegistrationNotifications: async () => { calls++ }, processRegistrationEmails: async () => { calls++ } },
  }).load('app/api/admin/diwali/notifications/route.ts')
  for (const method of ['GET', 'PUT', 'POST']) assert.equal((await api[method](new Request('https://sara.test/api/admin/diwali/notifications', { method }))).status, 403)
  allowed = true
  for (const method of ['PUT', 'POST']) assert.equal((await api[method](new Request('https://sara.test/api/admin/diwali/notifications', { method, headers: { origin: 'https://attacker.test' } }))).status, 403)
  assert.equal(calls, 0)
})

test('registration schedules mail only after a successful save and the HTTP response remains successful', async () => {
  const callbacks = [], processed = []; let saved = false, shouldFail = false
  const nextServer = { ...require('next/server'), after: callback => callbacks.push(callback) }
  const route = sourceLoader({
    'next/server': nextServer,
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'verified-cookie' }) }) },
    '@/lib/diwali/http': { body: async () => ({}), requireSameOrigin() {}, limit: async () => {}, json: (value, status) => Response.json(value, { status }), errorResponse: () => Response.json({ error: 'Save failed' }, { status: 409 }) },
    '@/lib/diwali/service': { register: async () => { if (shouldFail) throw new Error('Synthetic save failure'); saved = true; return { reference: 'SARA-DIW-DEMO' } } },
    '@/lib/diwali/registration-notifications': { processRegistrationEmails: async reference => { assert.equal(saved, true); processed.push(reference) } },
  }).load('app/api/diwali/register/route.ts')
  const response = await route.POST(new Request('https://sara.test/api/diwali/register', { method: 'POST' }))
  assert.equal(response.status, 201)
  assert.equal(processed.length, 0)
  await callbacks[0]()
  assert.deepEqual(processed, ['SARA-DIW-DEMO'])
  shouldFail = true
  assert.equal((await route.POST(new Request('https://sara.test/api/diwali/register', { method: 'POST' }))).status, 409)
  assert.equal(callbacks.length, 1)
})
