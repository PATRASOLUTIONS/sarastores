import test from 'node:test'
import assert from 'node:assert/strict'
import { sourceLoader } from './source-loader.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('posters hide exactly at their deadline; Never and legacy missing deadlines remain eligible', () => {
  const { bannerIsVisible, deadlineIndiaInput, deadlineFromIndiaInput } = sourceLoader().load('lib/banner-schedule.ts')
  const expiresAt = deadlineFromIndiaInput('2026-11-04T23:59')
  assert.equal(expiresAt, '2026-11-04T18:29:00.000Z')
  assert.equal(deadlineIndiaInput(expiresAt), '2026-11-04T23:59')
  assert.equal(bannerIsVisible({ active: true, expiresAt }, Date.parse(expiresAt) - 1), true)
  assert.equal(bannerIsVisible({ active: true, expiresAt }, Date.parse(expiresAt)), false)
  assert.equal(bannerIsVisible({ active: true, expiresAt: null }, Date.parse(expiresAt) + 1000), true)
  assert.equal(bannerIsVisible({ active: true }, Date.parse(expiresAt) + 1000), true)
  assert.equal(bannerIsVisible({ active: false }), false)
  assert.equal(bannerIsVisible({ active: true, expiresAt: 'invalid' }), false)
  for (const value of ['2026-02-30T12:00', '2026-11-04T25:00', 'invalid']) assert.throws(() => deadlineFromIndiaInput(value))
})

test('expired scoped posters release their slot to a default poster in order', () => {
  const { selectVisibleBanners } = sourceLoader().load('lib/banner-schedule.ts')
  const now = Date.parse('2026-11-04T10:00:00Z')
  const banners = [{ id: 'later', active: true, order: 2 }, { id: 'earlier', active: true, order: 1 }, { id: 'expired', active: true, order: 0, scope: 'TV', expiresAt: new Date(now).toISOString() }]
  assert.deepEqual(Array.from(selectVisibleBanners(banners, 'tv', now), banner => banner.id), ['earlier', 'later'])
  banners[2].expiresAt = new Date(now + 1000).toISOString()
  assert.deepEqual(Array.from(selectVisibleBanners(banners, ' TV ', now), banner => banner.id), ['expired'])
})

test('banner API saves normalized deadlines, supports clearing to Never and filters public requests', async () => {
  let inserted, updated, query, adminChecks = 0
  const id = 'a'.repeat(24)
  const loader = sourceLoader({
    '@/lib/auth': { requireAdmin: async () => { adminChecks++; return { ok: true, user: { id: 'admin' } } } },
    '@/lib/db-service': { normalizeId: row => ({ ...row, id }), createObjectId: value => value, getCollection: async () => ({
      insertOne: async value => { inserted = value; return { insertedId: id } },
      updateOne: async (_filter, value) => { updated = value.$set; return { matchedCount: 1 } },
      find: filter => { query = filter; return { sort: () => ({ toArray: async () => [] }) } },
    }) },
  })
  const { POST, PUT, GET } = loader.load('app/api/listing-banners/route.ts')
  const request = (method, json) => new Request(`https://sara.test/api/listing-banners?id=${id}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) })
  const response = await POST(request('POST', { placement: 'home-hero', image: '/fixture.webp', active: true, expiresAt: '2026-11-04T23:59:00+05:30' }))
  assert.equal(response.status, 200)
  assert.equal(inserted.expiresAt, '2026-11-04T18:29:00.000Z')
  assert.equal((await PUT(request('PUT', { expiresAt: null }))).status, 200)
  assert.equal(updated.expiresAt, null)
  assert.equal((await PUT(request('PUT', { active: false }))).status, 200)
  assert.equal(Object.hasOwn(updated, 'expiresAt'), false, 'visibility changes must preserve the saved deadline')
  assert.equal((await PUT(request('PUT', { expiresAt: 'not a date' }))).status, 400)
  await GET(new Request('https://sara.test/api/listing-banners?placement=home-hero'))
  assert.equal(query.active, true)
  assert.equal(query.placement, 'home-hero')
  assert.equal(query.$or.length, 3)
  assert.ok(Number.isFinite(Date.parse(query.$or[2].expiresAt.$gt)))
  const before = adminChecks
  await GET(new Request('https://sara.test/api/listing-banners?all=1'))
  assert.equal(adminChecks, before + 1)
  assert.equal(query.active, undefined)
  assert.equal(query.$or, undefined)
})

test('open storefronts schedule expiry locally and refresh after another tab saves', () => {
  const now = Date.parse('2026-11-04T10:00:00Z'), deadlines = [], handlers = {}, cleaned = []
  let refreshed = 0
  class FixtureDate extends Date { static now() { return now } }
  const loader = sourceLoader({
    react: { useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] }, useEffect(callback) { const cleanup = callback(); if (cleanup) cleaned.push(cleanup) } },
    swr: { __esModule: true, default: () => ({ data: [{ id: 'future', placement: 'home-hero', title: 'Future', active: true, expiresAt: new Date(now + 5000).toISOString() }], mutate() { refreshed++ } }) },
  }, { context: { Date: FixtureDate, window: { setTimeout(callback, delay) { deadlines.push(delay); return 1 }, clearTimeout() {}, addEventListener(name, handler) { handlers[name] = handler }, removeEventListener() {} } } })
  const { useBanners } = loader.load('hooks/useBanners.ts')
  const { BANNER_UPDATE_KEY } = loader.load('lib/banner-schedule.ts')
  assert.equal(useBanners('home-hero')[0].id, 'future')
  assert.deepEqual(deadlines, [5001])
  handlers.storage({ key: BANNER_UPDATE_KEY })
  assert.equal(refreshed, 1)
  cleaned.forEach(cleanup => cleanup())
})

test('placement map explains expiry and shared slots and reflects replacement artwork', () => {
  const loader = sourceLoader({
    react: { useEffect() {}, useState(initial) { return [typeof initial === 'function' ? initial() : initial, () => {}] } },
    '@/components/SiteImage': props => createElement('img', { src: props.src, alt: props.alt }),
    '@/hooks/useMarketingContent': { useMarketingContent: () => ({ enabled: () => true }) },
  })
  const Component = loader.load('components/admin/BannerPlacementMap.tsx').default
  const banners = [
    { id: 'statement', placement: 'home-statement', title: 'Statement', active: true, order: 0 },
    { id: 'strip', placement: 'home-strip', title: 'Strip', active: true, order: 0 },
    { id: 'card1', placement: 'home-card', title: 'Card one', active: true, order: 0, image: '/replacement.webp' },
    { id: 'card2', placement: 'home-card', title: 'Card two', active: true, order: 0 },
    { id: 'expired', placement: 'home-card', title: 'Old poster', active: true, expiresAt: '2000-01-01T00:00:00Z' },
  ]
  const html = renderToStaticMarkup(createElement(Component, { banners, draftId: 'card1', filter: 'home', edit() {}, add() {} }))
  assert.match(html, /Expired — hidden/)
  assert.match(html, /Deadline: Never/)
  assert.match(html, /Unsaved section preview/)
  assert.match(html, /src="\/replacement.webp"/)
  assert.match(html, /Waiting for an earlier slot/)
  assert.equal((html.match(/Selected for this section/g) || []).length, 2)
})
