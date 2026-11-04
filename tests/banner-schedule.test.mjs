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
      findOne: async () => inserted,
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

test('weekday choices and date ranges combine using IST with inclusive starts and exclusive ends', () => {
  const { bannerIsVisible, bannerVisibilityStatus, selectVisibleBanners } = sourceLoader().load('lib/banner-schedule.ts')
  const sunday = Date.parse('2026-11-07T18:30:00Z')
  const monday = sunday + 24 * 60 * 60_000
  const tuesday = monday + 24 * 60 * 60_000
  const poster = { id: 'weekend', active: true, weekdays: [0, 1], startsAt: new Date(sunday).toISOString(), expiresAt: new Date(tuesday + 1000).toISOString(), scope: 'TV' }
  assert.equal(bannerIsVisible(poster, sunday - 1), false)
  assert.equal(bannerVisibilityStatus(poster, sunday - 1), 'Scheduled — not started')
  assert.equal(bannerIsVisible(poster, sunday), true)
  assert.equal(bannerIsVisible(poster, monday), true)
  assert.equal(bannerIsVisible(poster, tuesday), false)
  assert.equal(bannerVisibilityStatus(poster, tuesday), 'Not scheduled for today — hidden')
  assert.equal(bannerVisibilityStatus(poster, tuesday + 1000), 'Expired — hidden')
  assert.equal(bannerIsVisible({ ...poster, weekdays: null }, tuesday), true)
  const fallback = { id: 'default', active: true }
  assert.deepEqual(Array.from(selectVisibleBanners([poster, fallback], 'tv', tuesday), item => item.id), ['default'])
})

test('local schedule transitions include future start times and IST midnight', () => {
  const { nextBannerTransition } = sourceLoader().load('lib/banner-schedule.ts')
  const now = Date.parse('2026-11-07T18:29:50Z')
  assert.equal(nextBannerTransition([{ active: true, weekdays: [0] }], now), now + 10000)
  assert.equal(nextBannerTransition([{ active: true, startsAt: new Date(now + 5000).toISOString(), weekdays: [0] }], now), now + 5000)
  assert.equal(nextBannerTransition([{ active: true, weekdays: null, expiresAt: null }], now), null)
  assert.equal(nextBannerTransition([{ active: false, weekdays: [0] }], now), null)
})

test('an open storefront reveals future posters and releases weekday slots without another fetch', () => {
  let now = Date.parse('2026-11-07T18:29:55Z'), state = now, timer
  const start = now + 5000
  class FixtureDate extends Date { static now() { return now } }
  const data = [
    { id: 'sunday', title: 'Sunday poster', placement: 'hero', active: true, scope: 'TV', weekdays: [0], startsAt: new Date(start).toISOString() },
    { id: 'fallback', title: 'Default poster', placement: 'hero', active: true },
  ]
  const loader = sourceLoader({
    react: { useState() { return [state, value => { state = value }] }, useEffect(callback) { callback() } },
    swr: { __esModule: true, default: url => { assert.match(url, /schedule=1/); return { data, mutate() {} } } },
  }, { context: { Date: FixtureDate, window: {
    setTimeout(callback) { timer = callback; return 1 }, clearTimeout() {}, addEventListener() {}, removeEventListener() {},
  } } })
  const { useBanners } = loader.load('hooks/useBanners.ts')
  assert.equal(useBanners('hero', 'tv')[0].id, 'fallback')
  now = start; timer()
  assert.equal(useBanners('hero', 'tv')[0].id, 'sunday')
  now = start + 24 * 60 * 60_000; timer()
  assert.equal(useBanners('hero', 'tv')[0].id, 'fallback')
})

test('API validates complete and partial schedules and keeps future candidates available to storefront timers', async () => {
  const id = 'b'.repeat(24), updates = []
  let saved = { _id: id, placement: 'home-hero', title: 'Scheduled poster', active: true, startsAt: '2098-01-01T00:00:00.000Z', expiresAt: '2099-01-01T00:00:00.000Z', weekdays: [0] }
  const loader = sourceLoader({
    '@/lib/auth': { requireAdmin: async () => ({ ok: true }) },
    '@/lib/db-service': { normalizeId: row => ({ ...row, id }), createObjectId: value => value, getCollection: async () => ({
      findOne: async () => saved,
      insertOne: async value => { saved = { ...value, _id: id }; return { insertedId: id } },
      updateOne: async (_filter, update) => { updates.push(update.$set); saved = { ...saved, ...update.$set }; return { matchedCount: 1 } },
      find: () => ({ sort: () => ({ toArray: async () => [saved] }) }),
    }) },
  })
  const { POST, PUT, GET } = loader.load('app/api/listing-banners/route.ts')
  const request = (method, json) => new Request(`https://sara.test/api/listing-banners?id=${id}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) })
  assert.equal((await GET(new Request('https://sara.test/api/listing-banners'))).status, 200)
  assert.equal((await (await GET(new Request('https://sara.test/api/listing-banners'))).json()).length, 0)
  assert.equal((await (await GET(new Request('https://sara.test/api/listing-banners?schedule=1'))).json()).length, 1)
  assert.equal((await (await GET(new Request('https://sara.test/api/listing-banners?all=1'))).json()).length, 1)
  assert.equal((await PUT(request('PUT', { expiresAt: '2097-01-01T00:00:00Z' }))).status, 400)
  assert.equal(updates.length, 0, 'partial updates must check the existing start')
  assert.equal((await PUT(request('PUT', { startsAt: null, weekdays: null }))).status, 200)
  assert.equal(saved.expiresAt, '2099-01-01T00:00:00.000Z')
  for (const weekdays of [[], [0, 0], [7], [-1], ['Sunday']]) assert.equal((await POST(request('POST', { placement: 'home-hero', weekdays }))).status, 400)
  assert.equal((await POST(request('POST', { placement: 'home-hero', startsAt: '2099-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z' }))).status, 400)
  assert.equal((await POST(request('POST', { placement: 'home-hero', startsAt: '2026-11-08T00:00:00+05:30', expiresAt: '2026-11-10T00:00:00+05:30', weekdays: [0, 1] }))).status, 200)
  assert.equal(saved.startsAt, '2026-11-07T18:30:00.000Z')
  assert.equal(saved.expiresAt, '2026-11-09T18:30:00.000Z')
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
