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
      return accepted ? { success: true, data: { messaging_product: 'whatsapp', messages: [{ id: 'synthetic-message' }] } }
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
