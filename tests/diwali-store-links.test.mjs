import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { sourceLoader } from './source-loader.mjs'

const defaults = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
const token = id => `s_${Buffer.from(id).toString('base64url')}`

test('every retail store gets a stable link, zero counts, manual-store coverage and scoped analytics', async () => {
  const stores = Array.from({ length: 93 }, (_, i) => ({ _id: `store-${i}`, storeCode: `S${i}`, shopName: `Synthetic branch ${i}`, isActive: true }))
  let scope
  const loader = sourceLoader({ '@/lib/db-service': { getCollection: async name => ({
    find(filter, options) {
      const rows = name === 'store_locations' ? stores : [{ _id: token('store-1'), opens: 4, lastOpenedAt: new Date('2026-11-04T10:00:00Z') }]
      if (name === 'store_locations') {
        assert.equal(filter.$or[0].locationType, 'store')
        assert.deepEqual(Object.keys(options.projection).sort(), ['isActive', 'shopName', 'storeCode'])
      }
      return { sort() { return this }, async toArray() { return rows } }
    },
    aggregate(pipeline) { scope = pipeline[0].$match.$and[0]; return { async toArray() { return [{ _id: token('store-1'), count: 2 }] } } },
  }) } })
  const { listStoreLinks } = loader.load('lib/diwali/store-links.ts')
  const config = { ...defaults, stores: [{ code: 'S1', name: 'Campaign branch' }, { code: 'EXTRA', name: 'Manual branch' }] }
  const links = await listStoreLinks(config, [], 'https://sara.test')
  assert.equal(links.length, 94)
  assert.equal(new Set(links.map(store => store.url)).size, 94)
  assert.equal(links[0].opens, 0)
  assert.equal(links[1].opens, 4)
  assert.equal(links[1].registrations, 2)
  assert.equal(links[1].inCampaign, true)
  assert.equal(links[1].url, `https://sara.test/diwali-gift/store/${token('store-1')}`)
  stores[1].shopName = 'Renamed branch'
  const limited = await listStoreLinks(config, ['S1'], 'https://sara.test', { status: 'approved' })
  assert.equal(limited.length, 1)
  assert.equal(limited[0].url, links[1].url)
  assert.equal(scope.status, 'approved')
})

test('scan opens increment atomically with an IST day and no visitor history', async () => {
  let recorded
  const { recordStoreOpen } = sourceLoader({ '@/lib/db-service': { getCollection: async name => {
    assert.equal(name, 'diwali_store_opens')
    return { async updateOne(...args) { recorded = args } }
  } } }).load('lib/diwali/store-links.ts')
  await recordStoreOpen({ id: token('one'), code: 'ONE', name: 'Synthetic branch' }, new Date('2026-11-04T20:00:00Z'))
  assert.equal(recorded[0]._id, token('one'))
  assert.equal(recorded[1].$inc.opens, 1)
  assert.equal(recorded[1].$inc['days.2026-11-05'], 1)
  assert.equal(recorded[2].upsert, true)
  assert.doesNotMatch(JSON.stringify(recorded), /userAgent|device|address|visitor|mobile/i)
})

test('store referral cookies reject spoofing, expiry and malformed identities', () => {
  const { createStoreReferral, readStoreReferral, STORE_REFERRAL_AGE } = sourceLoader().load('lib/diwali/store-links.ts')
  const now = 1793793600000, signed = createStoreReferral(token('one'), now)
  assert.equal(readStoreReferral(signed, now).id, token('one'))
  assert.equal(readStoreReferral(signed.replace(token('one'), token('two')), now), null)
  assert.equal(readStoreReferral(signed, now + (STORE_REFERRAL_AGE + 1) * 1000), null)
  assert.equal(readStoreReferral(`${signed}.extra`, now), null)
  assert.equal(createStoreReferral('https://attacker.test', now), null)
  assert.equal(readStoreReferral(createStoreReferral(token('one'), now + 120000), now), null)
})

test('QR landing redirects to registration, stores attribution and ignores prefetch, bots and HEAD', async () => {
  let opens = 0
  const loader = sourceLoader({
    '@/lib/diwali/service': { async getConfig() { return defaults } },
    '@/lib/diwali/http': { async limit() {} },
    '@/lib/db-service': { getCollection: async name => ({
      async findOne(filter) { return filter.$and[1].$or[0]._id === 'one' ? { _id: 'one', shopName: 'Branch', storeCode: 'ONE', isActive: true } : null },
      async updateOne() { assert.equal(name, 'diwali_store_opens'); opens++ },
    }) },
  })
  const { GET, HEAD } = loader.load('app/diwali-gift/store/[id]/route.ts')
  const ctx = { params: Promise.resolve({ id: token('one') }) }
  const url = `https://sara.test/diwali-gift/store/${token('one')}?redirect=https://attacker.test`
  const response = await GET(new Request(url), ctx)
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('location'), 'https://sara.test/diwali-gift?store=ONE')
  assert.match(response.headers.get('set-cookie'), /diwali_store_referral=.*HttpOnly/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  for (const headers of [{ purpose: 'prefetch' }, { 'sec-purpose': 'prefetch' }, { 'user-agent': 'Googlebot' }, { rsc: '1' }]) {
    const ignored = await GET(new Request(url, { headers }), ctx)
    assert.equal(ignored.headers.get('set-cookie'), null)
  }
  await HEAD(new Request(url, { method: 'HEAD' }))
  await GET(new Request(url), { params: Promise.resolve({ id: 'bad' }) })
  assert.equal(opens, 1)
})

test('staff accounts must exist and be ready before opening, with field-specific errors', async () => {
  let account = { _id: 'staff-one', name: 'Staff', email: 'staff@example.invalid', role: 'user', dashboardAccess: false, allowedPages: [] }
  const { validateCampaignStaff } = sourceLoader({ '@/lib/db-service': { getCollection: async () => ({
    find(filter, options) {
      assert.equal(options.projection.password, undefined)
      return { sort() { return this }, limit() { return this }, async toArray() { return account ? [account] : [] } }
    },
  }) } }).load('lib/diwali/store-links.ts')
  const config = { ...defaults, staff: [{ userId: 'staff-one', role: 'verifier', export: false, stores: [] }] }
  await validateCampaignStaff(config)
  await assert.rejects(() => validateCampaignStaff({ ...config, enabled: true }), error => error.field === 'staff' && /dashboard access/.test(error.message))
  account.dashboardAccess = true; account.allowedPages = ['/admin/orders']
  await assert.rejects(() => validateCampaignStaff({ ...config, enabled: true }), /page grant/)
  account.allowedPages = ['/admin/diwali']
  await validateCampaignStaff({ ...config, enabled: true })
  account.isActive = false
  await assert.rejects(() => validateCampaignStaff({ ...config, enabled: true }), /active status/)
  account = null
  await assert.rejects(() => validateCampaignStaff(config), /existing account/)
})

test('store directory and analytics endpoints require campaign authorization before loading data', async () => {
  for (const route of ['setup', 'stores']) {
    const denied = sourceLoader({ '@/lib/auth': { async requireUser() { return { ok: false, response: new Response(null, { status: 401 }) } } } }).load(`app/api/admin/diwali/${route}/route.ts`)
    assert.equal((await denied.GET(new Request(`https://sara.test/api/admin/diwali/${route}`))).status, 401)
    const forbidden = sourceLoader({
      '@/lib/auth': { async requireUser() { return { ok: true, user: { id: 'outsider', role: 'user' } } } },
      '@/lib/db-service': { getCollection: async name => {
        assert.equal(name, 'diwali_config'); return { async findOne() { return null } }
      } },
    }).load(`app/api/admin/diwali/${route}/route.ts`)
    assert.equal((await forbidden.GET(new Request(`https://sara.test/api/admin/diwali/${route}`))).status, 403)
  }
})

test('duplicate holidays and unknown staff stores cannot be saved', () => {
  const { ConfigSchema } = sourceLoader().load('lib/diwali/schemas.ts')
  assert.equal(ConfigSchema.safeParse({ ...defaults, holidays: ['2026-11-06', '2026-11-06'] }).success, false)
  assert.equal(ConfigSchema.safeParse({ ...defaults, staff: [{ userId: 'one', role: 'verifier', export: false, stores: ['UNKNOWN'] }] }).success, false)
})

test('submitted registrations retain only signed store attribution and remain idempotent', async () => {
  const config = { ...defaults, enabled: true, rulesConfirmed: true, calendarConfirmed: true,
    campaignStart: '2020-01-01', campaignEnd: '2099-01-01', registrationStart: '2020-01-01', registrationEnd: '2099-01-01',
    termsEn: 'Approved', termsKn: 'Approved', privacyEn: 'Approved', privacyKn: 'Approved', stores: [{ code: 'ONE', name: 'Branch' }] }
  const claims = []
  const session = { async withTransaction(work) { return work() }, async endSession() {} }
  const loader = sourceLoader({
    '@/lib/mongodb': { async connectToDatabase() { return { client: { startSession() { return session } } } } },
    '@/lib/db-service': { getCollection: async name => ({
      async findOne(filter) {
        if (name === 'diwali_config') return { _id: '2026', ...config }
        if (name === 'diwali_sessions') return { mobile: '9000000099', verifiedAt: new Date() }
        if (name === 'diwali_blocklist') return null
        if (name === 'diwali_notification_settings') return null
        if (name === 'diwali_claims') return claims.find(claim => filter.$or ? filter.$or.some(match => match.mobile === claim.mobile || match.email && new RegExp(match.email.$regex, match.email.$options).test(claim.email)) : claim.requestKey === filter.requestKey) || null
        if (name === 'store_locations') return { _id: 'one', shopName: 'QR branch', storeCode: 'ONE', isActive: true }
        throw new Error(`Unexpected lookup: ${name}`)
      },
      async createIndexes() {}, async createIndex() {},
      async insertOne(row, options) { assert.equal(options.session, session); if (name === 'diwali_claims') claims.push(row) },
    }) },
  })
  const { createStoreReferral } = loader.load('lib/diwali/store-links.ts')
  const { register } = loader.load('lib/diwali/service.ts')
  const { RegistrationSchema } = loader.load('lib/diwali/schemas.ts')
  const input = { requestId: randomUUID(), email: 'synthetic@example.invalid', name: 'Synthetic Customer', address: 'Synthetic Street 123', city: 'Bengaluru', district: 'Bengaluru', pincode: '560001', storeCode: 'ONE', invoice: 'SYNTH-1', enteredValue: 26000, language: 'en', accuracy: true, whatsappConsent: false, consentVersion: config.consentVersion }
  assert.equal(RegistrationSchema.safeParse({ ...input, referralStoreId: token('spoofed') }).success, false)
  const result = await register('verified-session', input, createStoreReferral(token('one')))
  assert.equal(claims[0].referralStoreId, token('one'))
  assert.equal(claims[0].referralStoreName, 'QR branch')
  assert.equal(claims[0].mobile, '9000000099')
  assert.equal(result.referralStoreId, undefined)
  await register('verified-session', input, 'spoofed-cookie')
  assert.equal(claims.length, 1)
  await assert.rejects(register('verified-session', { ...input, requestId: randomUUID(), invoice: 'SYNTH-2' }, 'spoofed-cookie'), /already has a Diwali registration/)
  assert.equal(claims.length, 1)
})
