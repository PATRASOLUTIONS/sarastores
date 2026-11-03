import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'

test('Diwali gift engine matches every approved boundary and rejects unconfirmed fractional values', () => {
  const { giftForRupees } = sourceLoader().load('lib/diwali/rules.ts')
  for (const [amount, code] of [[14999, null], [15000, 'silver5'], [25999, 'silver5'], [26000, 'silver10'], [50000, 'silver10'], [50001, 'silver15'], [80000, 'silver15'], [80001, 'silver20'], [100000, 'silver20'], [100001, 'gold1'], [25999.5, null], [NaN, null], [Infinity, null], [-1, null]]) assert.equal(giftForRupees(amount)?.code ?? null, code)
})
test('working-day SLA uses Kolkata dates, excludes approval day and configured holidays', () => {
  const { deliveryDueAt, indiaDate, isRealDate } = sourceLoader().load('lib/diwali/rules.ts')
  const approved = new Date('2026-11-06T20:00:00Z') // Saturday in India.
  assert.equal(indiaDate(approved), '2026-11-07')
  assert.equal(indiaDate(deliveryDueAt(approved, [1, 2, 3, 4, 5], ['2026-11-09'])), '2026-11-18')
  assert.equal(deliveryDueAt(approved, [1, 2, 3, 4, 5], []).toISOString(), '2026-11-17T18:29:59.999Z')
  assert.equal(isRealDate('2026-02-30'), false)
  assert.throws(() => deliveryDueAt(approved, [], []))
})
test('CSV exports escape formulas and quotes', () => {
  const { safeCsv } = sourceLoader().load('lib/diwali/rules.ts')
  assert.equal(safeCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
  assert.equal(safeCsv('normal'), '"normal"')
})
test('campaign remains closed without complete bilingual notices and approved policy', () => {
  const { ConfigSchema, DEFAULT_CONFIG, RegistrationSchema } = sourceLoader().load('lib/diwali/schemas.ts')
  assert.equal(ConfigSchema.safeParse(DEFAULT_CONFIG).success, true)
  assert.equal(ConfigSchema.safeParse({ ...DEFAULT_CONFIG, enabled: true }).success, false)
  assert.equal(ConfigSchema.safeParse({ ...DEFAULT_CONFIG, holidays: ['2026-02-30'] }).success, false)
  assert.equal(RegistrationSchema.safeParse({ mobile: '9000000000' }).success, false)
})
test('campaign permissions separate verification, fulfilment, management and export', () => {
  const { authorize } = sourceLoader().load('lib/diwali/service.ts')
  const config = { staff: [{ userId: 'v', role: 'verifier', export: false, stores: ['A'] }, { userId: 'f', role: 'fulfilment', export: false, stores: [] }, { userId: 'm', role: 'management', export: false, stores: [] }] }
  const user = id => ({ id, role: 'user', dashboardAccess: true })
  assert.equal(authorize(user('v'), config, 'verify').role, 'verifier')
  assert.throws(() => authorize(user('v'), config, 'fulfil'), /permission/)
  assert.throws(() => authorize(user('m'), config, 'verify'), /permission/)
  assert.throws(() => authorize(user('m'), config, 'export'), /permission/)
  assert.throws(() => authorize(user('unknown'), config, 'view'), /access denied/)
})
test('customer registration rejects cross-site requests before reading any credentials', async () => {
  const { POST } = sourceLoader().load('app/api/diwali/register/route.ts')
  const result = await POST(new Request('https://sara.test/api/diwali/register', { method: 'POST', headers: { origin: 'https://attacker.test', 'Content-Type': 'application/json' }, body: '{}' }))
  assert.equal(result.status, 403)
})
test('unsigned WhatsApp callbacks cannot mutate message status', async () => {
  const loader = sourceLoader({}, { env: { DIWALI_WEBHOOK_SECRET: 'synthetic-test-webhook-secret' } })
  const { POST } = loader.load('app/api/webhooks/diwali/whatsapp/route.ts')
  const result = await POST(new Request('https://sara.test/api/webhooks/diwali/whatsapp', { method: 'POST', body: JSON.stringify({ entry: [] }) }))
  assert.equal(result.status, 401)
})
