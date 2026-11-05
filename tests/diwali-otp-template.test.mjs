import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'

function fixture(overrides = {}, accepted = true) {
  const sent = [], inserted = [], updated = [], deleted = []
  const collection = {
    createIndexes: async () => {}, createIndex: async () => {},
    insertOne: async record => { inserted.push(record) },
    updateOne: async (filter, patch) => { updated.push({ filter, patch }) },
    deleteOne: async filter => { deleted.push(filter) },
  }
  const service = sourceLoader({
    '@/lib/db-service': { getCollection: async () => collection },
    '@/lib/whatsapp-template': { sendWhatsAppTemplate: async (mobile, template) => {
      sent.push({ mobile, template })
      return accepted === true ? { success: true, data: { messaging_product: 'whatsapp', messages: [{ id: 'synthetic-message' }] } }
        : accepted === 'unknown' ? { success: false, error: 'Synthetic timeout', deliveryUnknown: true }
        : { success: false, error: 'Synthetic rejection' }
    } },
  }, { env: { DIWALI_MESSAGING_ENABLED: 'true', DIWALI_OTP_TEMPLATE: 'synthetic_auth', ...overrides } }).load('lib/diwali/service.ts')
  return { service, sent, inserted, updated, deleted }
}

test('a single-language approved OTP template uses its configured language for either customer preference', async () => {
  for (const language of ['en', 'kn']) {
    const f = fixture({ DIWALI_OTP_LANGUAGE: 'en' })
    const challenge = await f.service.sendOtp('9876543210', language, 'status')
    assert.equal(f.sent.length, 1)
    const { template } = f.sent[0]
    assert.equal(template.name, 'synthetic_auth')
    assert.equal(template.language.code, 'en')
    const code = template.components[0].parameters[0].text
    assert.match(code, /^\d{6}$/)
    assert.equal(template.components[1].parameters[0].text, code)
    assert.equal(template.components[1].sub_type, 'url')
    assert.equal(f.inserted[0]._id, challenge)
    assert.equal(f.inserted[0].otpHash.length, 64)
    assert.equal(f.inserted[0].otp, undefined, 'Never store the plaintext code')
    assert.equal(f.updated[0].patch.$set.ready, true)
  }
})

test('bilingual OTP templates retain the customer language when no override is configured', async () => {
  const f = fixture()
  await f.service.sendOtp('9876543210', 'kn', 'status')
  assert.equal(f.sent[0].template.language.code, 'kn')
})

test('invalid OTP language prevents code creation and sending', async () => {
  const f = fixture({ DIWALI_OTP_LANGUAGE: 'invalid' })
  await assert.rejects(f.service.sendOtp('9876543210', 'en', 'status'), /language is not configured/)
  assert.equal(f.inserted.length, 0)
  assert.equal(f.sent.length, 0)
})

test('provider rejection removes the unusable challenge and never marks it ready', async () => {
  const f = fixture({ DIWALI_OTP_LANGUAGE: 'en' }, false)
  await assert.rejects(f.service.sendOtp('9876543210', 'kn', 'status'), /Could not send verification code/)
  assert.equal(f.deleted[0]._id, f.inserted[0]._id)
  assert.equal(f.updated.length, 0)
})

test('uncertain delivery keeps the delivered OTP verifiable instead of deleting its challenge', async () => {
  const f = fixture({ DIWALI_OTP_LANGUAGE: 'en' }, 'unknown')
  const challenge = await f.service.sendOtp('9876543210', 'en', 'status')
  assert.equal(f.inserted[0]._id, challenge)
  assert.equal(f.deleted.length, 0)
  assert.equal(f.updated[0].patch.$set.ready, true)
  assert.equal(f.updated[0].patch.$set.deliveryStatus, 'unknown')
  assert.equal(f.inserted[0].otp, undefined)
})

test('WhatsApp accepts message IDs with optional metadata and provider data envelopes', async () => {
  for (const payload of [
    { messages: [{ id: 'fixture-message' }] },
    { messaging_product: 'whatsapp', messages: [{ id: 'fixture-message', message_status: 'delivered' }] },
    { success: true, data: { messages: [{ id: 'fixture-message' }] } },
  ]) {
    const loader = sourceLoader({}, { env: { ASKEVA_API_KEY: 'fixture-key', ASKEVA_API_URL: 'https://provider.fixture.invalid' }, fetch: async () => Response.json(payload) })
    const result = await loader.load('lib/whatsapp-template.ts').sendWhatsAppTemplate('9876543210', { name: 'fixture', language: { code: 'en', policy: 'deterministic' }, components: [] })
    assert.equal(result.success, true)
    assert.equal(result.data.messages[0].id, 'fixture-message')
    assert.equal(result.data.messaging_product, 'whatsapp')
  }
})

test('provider rejection remains a failure while an incomplete success acknowledgement is uncertain', async () => {
  for (const [payload, status, unknown] of [
    [{ success: true }, 200, true],
    [{ error: 'Unavailable' }, 503, true],
    [{ error: 'Invalid template' }, 400, false],
    [{ success: false, data: { messages: [{ id: 'fixture-message' }] } }, 200, false],
    [{ data: { error: 'Rejected', messages: [{ id: 'fixture-message' }] } }, 200, false],
    [{ messages: [{ id: 'fixture-message', message_status: 'failed' }] }, 200, false],
  ]) {
    const loader = sourceLoader({}, { env: { ASKEVA_API_KEY: 'fixture-key', ASKEVA_API_URL: 'https://provider.fixture.invalid' }, fetch: async () => Response.json(payload, { status }) })
    const result = await loader.load('lib/whatsapp-template.ts').sendWhatsAppTemplate('9876543210', { name: 'fixture', language: { code: 'en', policy: 'deterministic' }, components: [] })
    assert.equal(result.success, false)
    assert.equal(result.deliveryUnknown === true, unknown)
  }
})

test('an OTP received despite an unfamiliar provider reply can be verified once and still rejects incorrect codes', async () => {
  let record, code
  const sessions = []
  const loader = sourceLoader({
    '@/lib/db-service': { getCollection: async name => ({
      createIndexes: async () => {}, createIndex: async () => {},
      async insertOne(row) { if (name === 'diwali_otp') record = structuredClone(row); if (name === 'diwali_sessions') sessions.push(row) },
      async updateOne(_filter, update) { if (name === 'diwali_otp') Object.assign(record, update.$set) },
      async deleteOne() { record = null },
      async findOneAndUpdate(filter) {
        if (!record || record._id !== filter._id || !record.ready || record.consumed || record.expiresAt <= new Date() || record.attempts >= 5) return null
        record.attempts++
        return structuredClone(record)
      },
    }) },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession: () => ({ withTransaction: async work => work(), endSession: async () => {} }) } }) },
  }, { env: { DIWALI_MESSAGING_ENABLED: 'true', DIWALI_OTP_TEMPLATE: 'fixture_auth', ASKEVA_API_KEY: 'fixture-key', ASKEVA_API_URL: 'https://provider.fixture.invalid' }, fetch: async (_url, options) => {
    code = JSON.parse(options.body).template.components[0].parameters[0].text
    return Response.json({ success: true })
  } })
  const service = loader.load('lib/diwali/service.ts')
  const challenge = await service.sendOtp('9876543210', 'en', 'status')
  assert.equal(record.deliveryStatus, 'unknown')
  assert.equal(record.otp, undefined)
  assert.equal((await service.verifyOtp(challenge, '000000')).ok, false)
  assert.equal(record.attempts, 1)
  assert.equal((await service.verifyOtp(challenge, code)).ok, true)
  assert.equal(sessions.length, 1)
  await assert.rejects(service.verifyOtp(challenge, code), /expired|attempts/)
})
