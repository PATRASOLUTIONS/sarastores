import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'
import { checkDeploymentEnvironment } from '../scripts/check-deployment-env.mjs'

const origin = 'https://www.sara.test'
const key = 'synthetic-indexnow-verification-key'
const env = { NODE_ENV: 'production', VERCEL_ENV: 'production', INDEXNOW_ENABLED: 'true', INDEXNOW_KEY: key, NEXT_PUBLIC_SITE_URL: origin, VERCEL_GIT_COMMIT_SHA: 'synthetic-revision' }
function harness() {
  const rows = new Map(), fetches = [], writes = []
  let entries = [{ url: `${origin}/product/synthetic`, lastModified: '2026-11-04' }], codes = [200], keyBody = key, keyStatus = 200, sitemapFails = false
  const state = {
    async findOne(filter) { return rows.get(filter._id) || null },
    find() { return { async toArray() { return [...rows.values()].filter(row => row.url) } } },
    async countDocuments() { return [...rows.values()].filter(row => row.url).length },
    async updateOne(filter, update, options) {
      const row = rows.get(filter._id)
      if (filter.$or && row?.leaseUntil > new Date()) throw Object.assign(new Error('Overlapping lease'), { code: 11000 })
      if (filter.owner && row?.owner !== filter.owner) return { modifiedCount: 0, upsertedCount: 0 }
      const next = { ...row, _id: filter._id, ...update.$set }
      for (const field of Object.keys(update.$unset || {})) delete next[field]
      writes.push({ filter, update, options }); rows.set(filter._id, next)
      return { modifiedCount: row ? 1 : 0, upsertedCount: row ? 0 : 1 }
    },
    async bulkWrite(operations) {
      writes.push(operations)
      for (const operation of operations) {
        if (operation.deleteOne) rows.delete(operation.deleteOne.filter._id)
        else { const { filter, update } = operation.updateOne; rows.set(filter._id, { _id: filter._id, ...update.$set }) }
      }
    },
  }
  const loader = sourceLoader({
    '@/app/sitemap': { __esModule: true, default: async () => { if (sitemapFails) throw new Error('Sitemap products source unavailable'); return entries } },
    '@/lib/db-service': { async getCollection(name) { if (name === 'indexnow_state') return state; assert.equal(name, 'settings'); return { find(filter, options) { assert.equal(options.projection.updatedAt, 1); return { async toArray() { return [] } } } } } },
  }, { env, fetch: async (url, options) => {
    fetches.push({ url, options })
    assert.equal(options.redirect, 'error')
    if (url === `${origin}/indexnow-key.txt`) return new Response(keyBody, { status: keyStatus })
    assert.equal(url, 'https://api.indexnow.org/indexnow')
    const body = JSON.parse(options.body)
    assert.equal(body.key, key); assert.equal(body.host, 'www.sara.test'); assert.equal(body.keyLocation, `${origin}/indexnow-key.txt`)
    assert.ok(body.urlList.length <= 1000)
    assert.ok(body.urlList.every(url => url.startsWith(origin + '/')))
    assert.deepEqual(Object.keys(body).sort(), ['host', 'key', 'keyLocation', 'urlList'])
    return new Response(null, { status: codes.length > 1 ? codes.shift() : codes[0] })
  } })
  return { loader, service: loader.load('lib/indexnow/service.ts'), rows, fetches, writes,
    setEntries(value) { entries = value }, setCodes(value) { codes = value }, setKey(value, status = 200) { keyBody = value; keyStatus = status }, failSitemap() { sitemapFails = true } }
}

test('IndexNow requires explicit production opt-in, a valid public origin and protocol key', () => {
  for (const overrides of [{ INDEXNOW_ENABLED: 'false' }, { NODE_ENV: 'development' }, { VERCEL_ENV: 'preview' }, { INDEXNOW_KEY: 'short' }, { NEXT_PUBLIC_SITE_URL: 'http://localhost:3000' }, { NEXT_PUBLIC_SITE_URL: 'https://10.0.0.1' }, { NEXT_PUBLIC_SITE_URL: 'https://preview.vercel.app' }]) {
    assert.equal(sourceLoader({}, { env: { ...env, ...overrides } }).load('lib/indexnow/config.ts').indexNowConfig().ready, false)
  }
  const config = sourceLoader({}, { env: { ...env, NEXT_PUBLIC_SITE_URL: 'https://sarastores.com' } }).load('lib/indexnow/config.ts').indexNowConfig()
  assert.equal(config.ready, true)
  assert.equal(config.keyUrl, 'https://www.sarastores.com/indexnow-key.txt')
})

test('deployment preflight validates enabled IndexNow without requiring disabled installations', () => {
  const errorsFor = env => checkDeploymentEnvironment(env).filter(error => error.startsWith('INDEXNOW'))
  assert.deepEqual(errorsFor({ INDEXNOW_ENABLED: 'false' }), [])
  assert.equal(errorsFor({ INDEXNOW_ENABLED: 'yes' }).length, 1)
  assert.equal(errorsFor({ INDEXNOW_ENABLED: 'true', INDEXNOW_KEY: 'short' }).length, 1)
  assert.equal(errorsFor({ INDEXNOW_ENABLED: 'true', INDEXNOW_KEY: key, NEXT_PUBLIC_SITE_URL: origin, INDEXNOW_SITE_URL: 'https://different.test' }).length, 1)
})

test('public verification file serves exactly the configured key without a login or HTML', async () => {
  const GET = sourceLoader({}, { env }).load('app/indexnow-key.txt/route.ts').GET
  const response = GET()
  assert.equal(response.status, 200)
  assert.equal(await response.text(), key)
  assert.match(response.headers.get('content-type'), /^text\/plain/)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(sourceLoader({}, { env: { INDEXNOW_KEY: 'bad/key' } }).load('app/indexnow-key.txt/route.ts').GET().status, 404)
})

test('only clean public sitemap routes are eligible; accounts, checkout, tokens and external URLs stay private', () => {
  const { publicIndexNowUrl } = harness().service
  for (const path of ['/admin/indexnow', '/api/orders', '/checkout', '/cart', '/order/secret', '/account', '/diwali-gift/store/secret', '/lucky-draw/secret/draw', '/product/item?token=secret', '/product/item#private', '/products?q=search', '/product/%0aheader']) assert.equal(publicIndexNowUrl(origin + path, origin), null)
  assert.equal(publicIndexNowUrl('https://attacker.test/product/item', origin), null)
  assert.equal(publicIndexNowUrl(`${origin}/stores/bengaluru/store-one`, origin), `${origin}/stores/bengaluru/store-one`)
  assert.equal(publicIndexNowUrl(`${origin}/product/item`, origin), `${origin}/product/item`)
})

test('initial sync verifies the deployed key; unchanged pages do not resubmit; updates and deletions do', async () => {
  const h = harness()
  let result = await h.service.runIndexNow()
  assert.equal(result.accepted, 1); assert.equal(result.remaining, 0)
  assert.equal(h.fetches[0].url, `${origin}/indexnow-key.txt`)
  result = await h.service.runIndexNow()
  assert.equal(result.attempted, 0); assert.equal(h.fetches.length, 2)
  h.setEntries([{ url: `${origin}/product/synthetic`, lastModified: '2026-11-05' }])
  assert.equal((await h.service.runIndexNow()).accepted, 1)
  h.setEntries([{ url: `${origin}/product/replacement`, lastModified: '2026-11-06' }])
  assert.equal((await h.service.runIndexNow()).accepted, 2)
  const urls = JSON.parse(h.fetches.at(-1).options.body).urlList
  assert.deepEqual(urls, [`${origin}/product/synthetic`, `${origin}/product/replacement`])
  assert.equal([...h.rows.values()].filter(row => row.url).length, 1)
})

test('preview and disabled runs do not submit or write state', async () => {
  const h = harness(), report = await h.service.runIndexNow({ dryRun: true })
  assert.equal(report.status, 'preview'); assert.equal(report.remaining, 1)
  assert.equal(h.fetches.length, 0); assert.equal(h.writes.length, 0)
  h.loader.env.INDEXNOW_ENABLED = 'false'
  assert.equal((await h.service.runIndexNow()).status, 'disabled')
  assert.equal(h.writes.length, 0)
})

test('unverified key, 202 verification, rate limits and provider failures retain URLs for retry', async () => {
  const h = harness()
  h.setKey('wrong deployed key')
  let report = await h.service.runIndexNow()
  assert.equal(report.status, 'failed'); assert.equal(report.accepted, 0)
  assert.equal(h.fetches.length, 1)
  h.setKey(key)
  for (const status of [202, 429, 403, 500]) {
    h.setCodes([status]); report = await h.service.runIndexNow()
    assert.equal(report.status, status === 202 ? 'pending' : 'failed')
    assert.equal(report.remaining, 1); assert.equal(report.accepted, 0)
    assert.equal([...h.rows.values()].filter(row => row.url).length, 0)
  }
  h.setCodes([200]); assert.equal((await h.service.runIndexNow()).accepted, 1)
})

test('sitemap outages, empty sitemap and wrong-origin sitemap cannot trigger deletion notifications', async () => {
  for (const broken of ['outage', 'empty', 'origin']) {
    const h = harness(); await h.service.runIndexNow(); const calls = h.fetches.length
    if (broken === 'outage') h.failSitemap()
    else h.setEntries(broken === 'empty' ? [] : [{ url: 'https://attacker.test/product/one' }])
    const report = await h.service.runIndexNow()
    assert.equal(report.status, 'failed'); assert.equal(h.fetches.length, calls)
    assert.equal([...h.rows.values()].filter(row => row.url).length, 1)
  }
})

test('batches resume from confirmed state and a shared lease prevents overlapping submissions', async () => {
  const h = harness()
  h.setEntries(Array.from({ length: 1001 }, (_, i) => ({ url: `${origin}/product/synthetic-${i}` })))
  let report = await h.service.runIndexNow({ maxBatches: 1 })
  assert.equal(report.accepted, 1000); assert.equal(report.remaining, 1)
  report = await h.service.runIndexNow({ maxBatches: 1 })
  assert.equal(report.accepted, 1); assert.equal(report.remaining, 0)
  h.rows.set('runner', { _id: 'runner', owner: 'other-job', leaseUntil: new Date(Date.now() + 120000) })
  const calls = h.fetches.length
  assert.equal((await h.service.runIndexNow()).status, 'busy')
  assert.equal(h.fetches.length, calls)
})

test('admin endpoints and cron require their own authorization; manual sync rejects cross-site requests', async () => {
  const admin = sourceLoader({ '@/lib/auth': { async requireFullAdmin() { return { ok: false, response: new Response(null, { status: 401 }) } } } }).load('app/api/admin/indexnow/route.ts')
  assert.equal((await admin.GET()).status, 401)
  assert.equal((await admin.POST(new Request(origin + '/api/admin/indexnow', { method: 'POST' }))).status, 401)
  const authenticated = sourceLoader({ '@/lib/auth': { async requireFullAdmin() { return { ok: true } } } }).load('app/api/admin/indexnow/route.ts')
  assert.equal((await authenticated.POST(new Request(origin + '/api/admin/indexnow', { method: 'POST', headers: { origin: 'https://attacker.test' } }))).status, 403)
  const cron = sourceLoader({ '@/lib/cron-auth': { requireCron() { return { ok: false, response: new Response(null, { status: 403 }) } } } }).load('app/api/cron/indexnow/route.ts')
  assert.equal((await cron.GET(new Request(origin + '/api/cron/indexnow'))).status, 403)
})

test('existing maintenance cron includes IndexNow without adding a third Vercel cron entry', async () => {
  let options
  const loader = sourceLoader({
    '@/lib/indexnow/service': { async runIndexNow(value) { options = value; return { status: 'disabled' } } },
    '@/lib/customer-profile': {}, '@/lib/retention/cart-recovery': {}, '@/lib/retention/wishlist-alerts': {},
    '@/lib/retention/lifecycle': {}, '@/lib/retention/segmentation': {}, '@/lib/retention/data-retention': {},
  })
  const { CRON_GROUPS } = loader.load('lib/cron/jobs.ts')
  assert.equal(CRON_GROUPS.maintenance[0].name, 'indexnow')
  await CRON_GROUPS.maintenance[0].run({ dryRun: true, budgetMs: 10000 })
  assert.equal(options.dryRun, true); assert.equal(options.maxBatches, 1); assert.equal(options.budgetMs, 10000)
})
