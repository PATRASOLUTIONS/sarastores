import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'

const identity = { mobile: '9876543210', email: 'shopper@example.com' }

test('submission receipts expire, bind both identifiers and reject tampering', () => {
  const loader = sourceLoader()
  const { createRegistrationCheck, readRegistrationCheck } = loader.load('lib/diwali/registration-check.ts')
  const token = createRegistrationCheck(identity)
  assert.equal(readRegistrationCheck(token, identity.mobile, ' SHOPPER@EXAMPLE.COM ').mobile, identity.mobile)
  for (const [mobile, email] of [['9123456789', identity.email], [identity.mobile, 'other@example.com'], [undefined, identity.email]]) {
    assert.throws(() => readRegistrationCheck(token, mobile, email), error => error.status === 401)
  }
  const [payload, signature] = token.split('.')
  const changed = JSON.parse(Buffer.from(payload, 'base64url').toString())
  changed.mobile = '9123456789'
  assert.throws(() => readRegistrationCheck(`${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`, changed.mobile, identity.email), error => error.status === 401)
  const future = sourceLoader({}, { env: { SESSION_SECRET: loader.env.SESSION_SECRET }, context: { Date: class extends Date { static now() { return Date.now() + 31 * 60_000 } } } }).load('lib/diwali/registration-check.ts')
  assert.throws(() => future.readRegistrationCheck(token, identity.mobile, identity.email), error => error.status === 401)
})

test('Verify API checks both identifiers, returns no customer records and grants only a submission cookie', async () => {
  let duplicate = false, reads = 0, limits = 0
  const defaults = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
  const config = { ...defaults, enabled: true, rulesConfirmed: true, calendarConfirmed: true, registrationStart: '2000-01-01', registrationEnd: '2099-12-31', stores: [{ code: 'A', name: 'Synthetic store' }], termsEn: 'Approved', termsKn: 'Approved', privacyEn: 'Approved', privacyKn: 'Approved' }
  const loader = sourceLoader({
    '@/lib/rate-limit-store': { rateLimitHit: async () => { limits++; return { limited: false } } },
    '@/lib/db-service': { getCollection: async name => ({ findOne: async query => {
      if (name === 'diwali_config') return { ...config, _id: '2026' }
      if (name !== 'diwali_claims') return null
      reads++
      assert.equal(query.$or[0].mobile, identity.mobile)
      assert.equal(query.$or[1].email.$options, 'i')
      return duplicate ? { _id: 'existing', name: 'Private customer', address: 'Private address' } : null
    } }) },
  })
  const { POST } = loader.load('app/api/diwali/registration-check/route.ts')
  const request = (value = identity, origin = 'https://sara.test') => new Request('https://sara.test/api/diwali/registration-check', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(value) })
  assert.equal((await POST(request(identity, 'https://attacker.test'))).status, 403)
  assert.equal(reads, 0); assert.equal(limits, 0)
  assert.equal((await POST(request({ ...identity, verified: true }))).status, 400)
  const response = await POST(request({ ...identity, email: ' SHOPPER@EXAMPLE.COM ' }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { available: true })
  const cookie = response.headers.get('set-cookie')
  assert.match(cookie, /diwali_registration_check=/)
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /Path=\/api\/diwali\/register;/)
  assert.doesNotMatch(cookie, /diwali_verified=/)
  duplicate = true
  const rejected = await POST(request())
  assert.equal(rejected.status, 409)
  assert.deepEqual(await rejected.json(), { error: 'This number or email ID is already used.' })
  assert.equal(rejected.headers.get('set-cookie'), null)
})

test('registration form has one Verify control and no OTP input in either language', () => {
  const Component = sourceLoader().load('components/diwali/GiftRegistration.tsx').default
  for (const language of ['en', 'kn']) {
    const nodes = []
    const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; nodes.push(node); visit(node.props.children) }
    visit(Component({ config: { registrationStart: '2026-11-05', registrationEnd: '2026-11-12', enabled: true, stores: [] }, language, mobile: identity.mobile, email: identity.email, verified: false, busy: false, amount: '26000', open: true, today: '2026-11-05' }))
    assert.equal(nodes.some(node => node.props.autoComplete === 'one-time-code'), false)
    const verify = nodes.find(node => node.type === 'button' && node.props.className.includes('shrink-0'))
    assert.equal(verify.props.disabled, false)
    if (language === 'en') assert.equal(verify.props.children, 'Verify')
    else assert.match(verify.props.children, /[\u0c80-\u0cff]/)
  }
})

test('registration endpoint accepts the submission receipt without an OTP cookie and validates the form', async () => {
  let calls = 0
  const loader = sourceLoader({
    'next/server': { ...(await import('next/server.js')), after() {} },
    'next/headers': { cookies: async () => ({ get: name => name === 'diwali_registration_check' ? { value: 'signed-submission-receipt' } : undefined }) },
    '@/lib/rate-limit-store': { rateLimitHit: async () => ({ limited: false }) },
    '@/lib/diwali/service': { register: async (otp, input, _referral, receipt) => {
      calls++; assert.equal(otp, undefined); assert.equal(receipt, 'signed-submission-receipt')
      assert.equal(input.mobile, identity.mobile); assert.equal(input.email, identity.email)
      return { reference: 'FIXTURE-REGISTRATION', status: 'pending' }
    } },
  })
  const { POST } = loader.load('app/api/diwali/register/route.ts')
  const input = { ...identity, requestId: 'cd63a98d-346b-4e63-a307-6a73720ff320', name: 'Synthetic Customer', address: 'Synthetic Street 123', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', storeCode: 'A', invoice: 'SYNTHETIC-1', enteredValue: 26000, language: 'en', accuracy: true, whatsappConsent: true, consentVersion: 'fixture-v1' }
  const request = value => new Request('https://sara.test/api/diwali/register', { method: 'POST', headers: { origin: 'https://sara.test', 'content-type': 'application/json' }, body: JSON.stringify(value) })
  assert.equal((await POST(request(input))).status, 201)
  assert.equal(calls, 1)
  assert.equal((await POST(request({ ...input, mobile: '123' }))).status, 400)
  assert.equal(calls, 1)
})


test('email is optional in registration and Verify schemas but malformed supplied email is rejected', () => {
  const loader = sourceLoader()
  const { RegistrationCheckSchema, createRegistrationCheck, readRegistrationCheck } = loader.load('lib/diwali/registration-check.ts')
  const { RegistrationSchema } = loader.load('lib/diwali/schemas.ts')
  const base = { mobile: '9876543210', requestId: 'cd63a98d-346b-4e63-a307-6a73720ff320', name: 'Synthetic Customer', address: 'Synthetic Street 123', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', storeCode: 'A', invoice: 'SYNTHETIC-1', enteredValue: 26000, language: 'en', accuracy: true, whatsappConsent: false, consentVersion: 'fixture-v1' }
  for (const email of [undefined, '', '   ']) {
    const identity = RegistrationCheckSchema.parse({ mobile: base.mobile, email })
    assert.equal(identity.email, '')
    assert.equal(RegistrationSchema.parse({ ...base, email }).email, '')
    const receipt = createRegistrationCheck(identity)
    assert.equal(readRegistrationCheck(receipt, base.mobile).mobile, base.mobile)
    assert.throws(() => readRegistrationCheck(receipt, base.mobile, 'changed@example.com'), error => error.status === 401)
  }
  assert.equal(RegistrationCheckSchema.safeParse({ mobile: base.mobile, email: 'invalid-email' }).success, false)
  assert.equal(RegistrationSchema.safeParse({ ...base, email: 'invalid-email' }).success, false)
})

test('phone-only Verify requests do not use a shared blank-email rate limit', async () => {
  let calls = 0, checked
  const loader = sourceLoader({
    '@/lib/rate-limit-store': { rateLimitHit: async () => { calls++; return { limited: false } } },
    '@/lib/diwali/service': { checkRegistrationDetails: async input => { checked = input; return 'signed-receipt' } },
  })
  const { POST } = loader.load('app/api/diwali/registration-check/route.ts')
  const response = await POST(new Request('https://sara.test/api/diwali/registration-check', { method: 'POST', headers: { origin: 'https://sara.test', 'content-type': 'application/json' }, body: JSON.stringify({ mobile: '9876543210' }) }))
  assert.equal(response.status, 200)
  assert.equal(calls, 2)
  assert.equal(checked.email, '')
})

test('the customer form enables Verify with only a phone number and marks email optional', () => {
  const Component = sourceLoader().load('components/diwali/GiftRegistration.tsx').default
  const rendered = []
  const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; rendered.push(node); visit(node.props.children) }
  visit(Component({ config: { registrationStart: '2026-11-05', registrationEnd: '2026-11-12', enabled: true, stores: [] }, language: 'en', mobile: '9876543210', email: '', verified: false, busy: false, amount: '26000', open: true, today: '2026-11-05' }))
  assert.equal(rendered.find(node => node.type === 'input' && node.props.name === 'email').props.required, undefined)
  assert.equal(rendered.find(node => node.type === 'button' && node.props.children === 'Verify').props.disabled, false)
})
