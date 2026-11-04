import assert from 'node:assert/strict'
import test from 'node:test'
import { ObjectId } from 'mongodb'
import { NextRequest } from 'next/server.js'
import { sourceLoader } from './source-loader.mjs'

const at = new Date('2026-11-07T12:00:00Z')
const defaults = sourceLoader().load('lib/diwali/schemas.ts').DEFAULT_CONFIG
const config = { ...defaults, enabled: true, rulesConfirmed: true, calendarConfirmed: true,
  stores: [{ code: 'A', name: 'Synthetic store' }], termsEn: 'Approved', termsKn: 'Approved', privacyEn: 'Approved', privacyKn: 'Approved' }
const order = { orderId: 'SARAECOM-SYNTHETIC', userId: 'session-customer', paymentMethod: 'razorpay', total: 26099, shipping: 99,
  customer: { name: 'Synthetic Customer', phone: '9000000099', email: 'synthetic@example.invalid', address: 'Synthetic Street 123', city: 'Bengaluru', state: 'Karnataka', zipCode: '560001' }, createdAt: at }

test('online eligibility uses net GST-inclusive merchandise and respects every slab and both IST windows', () => {
  const { onlineGift, onlineCampaignOpen } = sourceLoader().load('lib/diwali/online-rules.ts')
  for (const [value, code] of [[14999, null], [15000, 'silver5'], [25999, 'silver5'], [26000, 'silver10'], [50000, 'silver10'], [50001, 'silver15'], [80000, 'silver15'], [80001, 'silver20'], [100000, 'silver20'], [100001, 'gold1'], [25999.5, null]]) {
    assert.equal(onlineGift(config, value + 99, 99, at)?.giftCode ?? null, code)
  }
  assert.equal(onlineGift({ ...config, enabled: false }, 26000, 0, at), null)
  assert.equal(onlineGift({ ...config, campaignEnd: '2026-11-06' }, 26000, 0, at), null)
  assert.equal(onlineGift({ ...config, registrationStart: '2026-11-08' }, 26000, 0, at), null)
  assert.equal(onlineCampaignOpen(config, new Date('2026-11-04T18:30:00Z')), true)
  assert.equal(onlineCampaignOpen(config, new Date('2026-11-12T18:30:00Z')), false)
  assert.equal(onlineGift(config, NaN, 0, at), null)
  assert.equal(onlineGift(config, 26000, -1, at), null)
})

test('online gift allocation blocks unpaid, refunded, cancelled, reviewed and changed orders', () => {
  const { onlineOrderGiftError } = sourceLoader().load('lib/diwali/online-rules.ts')
  const paid = { ...order, status: 'confirmed', paymentVerification: { verified: true } }
  assert.equal(onlineOrderGiftError(paid, 26000), null)
  assert.match(onlineOrderGiftError({ ...paid, paymentVerification: { verified: false } }, 26000), /Awaiting payment/)
  for (const status of ['cancelled', 'refunded', 'partially_refunded', 'payment_review', 'payment_failed', 'returned']) assert.match(onlineOrderGiftError({ ...paid, status }, 26000), /Blocked/)
  assert.match(onlineOrderGiftError({ ...paid, total: 25999 }, 26000), /value changed/)
  assert.match(onlineOrderGiftError(null, 26000), /unavailable/)
  assert.equal(onlineOrderGiftError({ ...paid, paymentMethod: 'cod', status: 'delivered', paymentVerification: { verified: false } }, 26000), null)
})

test('automatic registration is idempotent and rolls back with a failed order transaction', async () => {
  let claims = new Map(), audits = [], orders = [], failInsert = true
  const session = { async withTransaction(work) {
    const before = [new Map(claims), [...audits], [...orders]]
    try { return await work() } catch (error) { [claims, audits, orders] = before; throw error }
  }, async endSession() {} }
  const loader = sourceLoader({
    '@/lib/db-service': { getCollection: async name => ({
      async findOne() { return null },
      async updateOne(filter, update, options) {
        assert.equal(name, 'diwali_claims'); assert.equal(options.session, session)
        if (claims.has(filter._id)) return { upsertedCount: 0 }
        claims.set(filter._id, update.$setOnInsert); return { upsertedCount: 1 }
      },
      async insertOne(row, options) { assert.equal(name, 'diwali_audit'); assert.equal(options.session, session); audits.push(row) },
    }) },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession: () => session }, db: { collection: name => ({
      async insertOne(row, options) { assert.equal(name, 'orders'); assert.equal(options.session, session); if (failInsert) throw new Error('Synthetic order failure'); orders.push(row) },
    }) } }) },
  })
  const gift = loader.load('lib/diwali/online-rules.ts').onlineGift(config, order.total, order.shipping, at)
  const record = loader.load('lib/diwali/online-orders.ts').recordOnlineDiwaliOrder
  const persist = loader.load('lib/checkout-payment.ts').persistCheckoutOrder
  const checkout = { ...order, diwaliGift: gift }
  await assert.rejects(persist(checkout, null, tx => record(checkout, tx)), /Synthetic order failure/)
  assert.equal(claims.size, 0); assert.equal(audits.length, 0)
  failInsert = false
  await persist(checkout, null, tx => record(checkout, tx))
  await record(checkout, session)
  assert.equal(orders.length, 1); assert.equal(claims.size, 1); assert.equal(audits.length, 1)
  const claim = [...claims.values()][0]
  assert.equal(claim.orderId, order.orderId); assert.equal(claim.userId, order.userId)
  assert.equal(claim.mobile, order.customer.phone); assert.equal(claim.address, order.customer.address)
  assert.equal(claim.storeCode, 'ONLINE'); assert.equal(claim.enteredValue, 26000)
  assert.equal(claim.status, 'pending'); assert.equal(claim.giftCode, 'silver10')
  assert.equal(claim.whatsappConsent, false); assert.equal(claim.verifiedMobileAt, undefined)
  assert.equal(claims.size, 1)
})

test('Diwali admin approval uses the linked order and locks online invoice identity and value', async () => {
  let writes = 0
  let claim = { _id: 'online:synthetic', source: 'online', orderId: order.orderId, name: order.customer.name,
    mobile: order.customer.phone, storeCode: 'ONLINE', invoice: order.orderId, enteredValue: 26000,
    giftCode: 'silver10', invoiceDate: '2026-11-07', status: 'pending', fulfilment: 'pending', version: 0, whatsappConsent: false }
  let paid = { ...order, status: 'pending', paymentVerification: { verified: false }, diwaliGift: { giftCode: 'silver10', eligibleValue: 26000 } }
  const session = { withTransaction: work => work(), endSession() {} }
  const loader = sourceLoader({
    '@/lib/db-service': { normalizeId: row => ({ ...row, id: row._id }), getCollection: async name => ({
      findOne: async () => name === 'diwali_config' ? { ...config, _id: '2026' } : name === 'diwali_claims' ? claim : name === 'orders' ? paid : null,
      createIndexes: async () => {}, createIndex: async () => {}, insertOne: async () => {},
      updateOne: async (_filter, update) => { writes++; claim = { ...claim, ...update.$set, version: claim.version + 1 }; return { modifiedCount: 1 } },
    }) },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession: () => session } }) },
  })
  const { actOnClaim } = loader.load('lib/diwali/service.ts')
  const action = { action: 'approve', version: 0, verifiedValue: 26000, invoiceDate: '2026-11-07', storeCode: 'ONLINE', note: 'Synthetic review', invoiceValid: true, notRefunded: true }
  const admin = { id: 'synthetic-admin', role: 'admin' }
  await assert.rejects(actOnClaim(admin, claim._id, action), /Awaiting payment/)
  paid = { ...paid, status: 'confirmed', paymentVerification: { verified: true } }
  await assert.rejects(actOnClaim(admin, claim._id, { ...action, verifiedValue: 100001 }), /cannot be changed/)
  await assert.rejects(actOnClaim(admin, claim._id, { action: 'correct', version: 0, storeCode: 'A', invoice: 'forged', note: 'Synthetic correction' }), /cannot be edited/)
  assert.equal(writes, 0)
  const approved = await actOnClaim(admin, claim._id, action)
  assert.equal(approved.status, 'approved'); assert.equal(approved.giftCode, 'silver10')
  paid.status = 'refunded'
  await assert.rejects(actOnClaim(admin, claim._id, { action: 'pack', version: 1, note: '' }), /Blocked/)
  assert.equal(writes, 1)
})

test('checkout validation returns server-calculated Diwali eligibility, ignoring a client gift value', async () => {
  const loader = sourceLoader({
    '@/lib/auth': { getSession: async () => ({ user: { id: 'session-customer' } }) },
    '@/lib/rate-limit': { checkRateLimit: async () => ({ success: true }), RATE_LIMITS: { API: {} } },
    '@/lib/diwali/service': { getConfig: async () => ({ ...config, campaignStart: '2000-01-01', campaignEnd: '2099-12-31', registrationStart: '2000-01-01', registrationEnd: '2099-12-31' }) },
    '@/lib/checkout-payment': { CheckoutQuoteSchema: sourceLoader().load('lib/checkout-payment.ts').CheckoutQuoteSchema,
      quoteCheckout: async (_items, options) => { assert.equal(options.userId, 'session-customer'); return { ok: true, amount: 25999, pricing: { shipping: 0 } } },
    },
  })
  const response = await loader.load('app/api/cart/validate/route.ts').POST(new NextRequest('https://synthetic.invalid/api/cart/validate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ id: 'synthetic', quantity: 1 }], userId: 'forged', diwaliGift: { giftCode: 'gold1', eligibleValue: 100001 } }),
  }))
  assert.equal(response.status, 200)
  const value = await response.json()
  assert.equal(value.diwaliGift.giftCode, 'silver5'); assert.equal(value.diwaliGift.eligibleValue, 25999)
})

test('placing an order registers its server-priced gift and session identity in the order transaction', async () => {
  let persisted, registered
  const session = { synthetic: true }
  const pricing = { ok: true, items: [{ id: 'synthetic-product', name: 'Synthetic Product', type: 'hardware', quantity: 1, price: 26000 }], subtotal: 22033.9, tax: 3966.1, shipping: 99, total: 26099, coupon: null, couponDiscount: 0 }
  const loader = sourceLoader({
    '@/lib/auth': { getSession: async () => ({ user: { id: 'session-customer', role: 'user' } }) },
    '@/lib/checkout-customer': { validateCheckoutCustomer: async () => ({ ok: true }) },
    '@/lib/checkout-idempotency': { idempotentCheckout: async (_request, _user, _scope, work) => work() },
    '@/lib/order-pricing': { priceOrder: async () => pricing },
    '@/lib/order-id': { generateOrderId: async () => order.orderId },
    '@/lib/gift-promotions': { quoteGiftPromotions: async () => [], consumeGiftPromotions: async () => {} },
    '@/lib/order-notifications': { notifyAdminOrder: async () => {} },
    '@/lib/emailTemplates': { emailTemplates: { ORDER_PENDING: { subject: 'Synthetic', html: () => '<p>Synthetic</p>' } } },
    '@/lib/checkout-payment': {
      checkoutFingerprint: () => 'synthetic-fingerprint',
      persistCheckoutOrder: async (row, _intent, beforeInsert) => { await beforeInsert(session); persisted = row; return new ObjectId() },
    },
    '@/lib/db-service': { normalizeId: row => ({ ...row, id: 'synthetic-order-id' }), getCollection: async name => ({
      findOne: async () => name === 'diwali_config' ? { ...config, _id: '2026', campaignStart: '2000-01-01', campaignEnd: '2099-12-31', registrationStart: '2000-01-01', registrationEnd: '2099-12-31' } : null,
      createIndexes: async () => {}, createIndex: async () => {}, insertOne: async () => {},
      updateOne: async (_filter, update, options) => {
        if (name === 'diwali_claims') { assert.equal(options.session, session); registered = update.$setOnInsert; return { upsertedCount: 1 } }
        return { modifiedCount: 1 }
      },
    }) },
  }, { env: { COD_ENABLED: 'true' } })
  const response = await loader.load('app/api/orders/route.ts').POST(new NextRequest('https://synthetic.invalid/api/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      items: [{ id: 'synthetic-product', quantity: 1, price: 100001 }], customer: { ...order.customer, email: 'synthetic@example.com', firstName: 'Synthetic', lastName: 'Customer' },
      paymentMethod: 'cod', total: 100001, userId: 'forged-user', diwaliGift: { giftCode: 'gold1', eligibleValue: 100001 },
    }),
  }))
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
  assert.equal(persisted.diwaliGift.giftCode, 'silver10'); assert.equal(persisted.diwaliGift.eligibleValue, 26000)
  assert.equal(registered.orderId, persisted.orderId); assert.equal(registered.userId, 'session-customer')
  assert.equal(registered.status, 'pending'); assert.equal(registered.mobile, order.customer.phone)
})

test('pickup gifts retain the trusted pickup destination even when contact-only checkout has no address', async () => {
  let claim
  const loader = sourceLoader({ '@/lib/db-service': { getCollection: async () => ({
    findOne: async () => null,
    updateOne: async (_filter, update) => { claim = update.$setOnInsert; return { upsertedCount: 0 } },
  }) } })
  const diwaliGift = loader.load('lib/diwali/online-rules.ts').onlineGift(config, order.total, order.shipping, at)
  await loader.load('lib/diwali/online-orders.ts').recordOnlineDiwaliOrder({ ...order, diwaliGift,
    customer: { ...order.customer, address: '', city: '', state: '', zipCode: '' },
    shippingAddress: { street: 'Synthetic pickup store address', city: 'Bengaluru', state: 'Karnataka', zip: '560001' },
    fulfilment: { method: 'pickup', storeName: 'Synthetic pickup store' },
  }, {})
  assert.equal(claim.address, 'Synthetic pickup store address'); assert.equal(claim.pincode, '560001')
  assert.equal(claim.deliveryMethod, 'pickup'); assert.equal(claim.pickupStoreName, 'Synthetic pickup store')
})

test('manual registration cannot reserve the online invoice namespace', async () => {
  const currentConfig = { ...config, stores: [...config.stores, { code: 'ONLINE', name: 'Website' }],
    campaignStart: '2000-01-01', campaignEnd: '2099-12-31', registrationStart: '2000-01-01', registrationEnd: '2099-12-31' }
  const loader = sourceLoader({ '@/lib/db-service': { getCollection: async name => ({
    findOne: async () => name === 'diwali_config' ? { ...currentConfig, _id: '2026' } : name === 'diwali_sessions' ? { mobile: '9000000099' } : null,
  }) } })
  const { register, publicConfig } = loader.load('lib/diwali/service.ts')
  await assert.rejects(register('synthetic-token', { requestId: 'synthetic-request', storeCode: 'ONLINE', invoice: order.orderId, consentVersion: config.consentVersion }), /automatically at checkout/)
  assert.equal(publicConfig(currentConfig).stores.some(store => store.code === 'ONLINE'), false)
})
