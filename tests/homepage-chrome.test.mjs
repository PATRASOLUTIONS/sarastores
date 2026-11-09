import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { sourceLoader } from './source-loader.mjs'

function fixture() {
  const effects = [], requests = [], keys = [], state = [], timers = []
  let index = 0
  const storage = { getItem: () => null, setItem() {}, removeItem() {} }
  const loader = sourceLoader({
    react: { ...React,
      useEffect: callback => effects.push(callback),
      useState(initial) { const slot = index++; if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial; return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value }] },
      useRef: value => ({ current: value }), useCallback: callback => callback,
    },
    swr: Object.assign(key => { keys.push(key); return { data: undefined, mutate() {} } }, { useSWRConfig: () => ({}) }),
    'next/navigation': { usePathname: () => '/', useRouter: () => ({ push() {} }) },
    '@/hooks/useCart': { useCart: () => ({ cart: [{ id: 'fixture-product', quantity: 2 }] }) },
    '@/hooks/useWishlist': { useWishlist: () => ({ wishlist: [{ id: 'fixture-product' }] }) },
    '@/contexts/CartUIContext': { useCartUI: () => ({ openCart() {} }) },
    '@/contexts/AuthContext': { useAuth: () => ({ user: { id: 'fixture-user', name: 'Fixture Customer' }, logout() {}, isAdmin: false, isVendor: false }) },
    '@/hooks/useAnimations': { useScrollState: () => ({ isScrolled: false }) },
    '@/components/Footer.module.css': {},
  }, {
    fetch: async (url, options) => { requests.push({ url, options }); return Response.json(String(url).includes("/api/products?search=") ? [] : { success: true, promotion: null }) },
    context: { localStorage: storage, sessionStorage: storage,
      window: { location: { pathname: '/', search: '' }, addEventListener() {}, removeEventListener() {}, dispatchEvent() {} },
      document: { addEventListener() {}, removeEventListener() {}, body: { style: {} } },
      CustomEvent: class {}, setTimeout: callback => { timers.push(callback); return timers.length }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    },
  })
  return { loader, effects, requests, keys, timers, reset: () => { index = 0 } }
}

function nodes(tree) {
  const found = []
  const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node?.props) return; found.push(node); visit(node.props.children) }
  visit(tree)
  return found
}

test('fixed homepage header starts no content requests and retains customer and search controls', async () => {
  const f = fixture()
  const Header = f.loader.load('components/Header.tsx').default
  const tree = Header({ staticContent: true })
  for (const effect of f.effects) effect()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.requests.length, 0)
  assert.ok(f.keys.every(key => key === null))
  const rendered = nodes(tree)
  assert.ok(rendered.some(node => node.props.children === '+91 90710 02220' || node.props.href === 'tel:+919071002220'))
  assert.ok(rendered.some(node => node.type === 'input' && node.props.placeholder === 'Search for products, brands and more...'))
  assert.ok(rendered.some(node => node.props.children === 'Hi, Fixture'))
  assert.ok(rendered.some(node => node.props['aria-label']?.includes('cart') || node.props.children === 'Cart'))
  rendered.find(node => node.type === 'input' && node.props.placeholder === 'Search for products, brands and more...').props.onChange({ target: { value: 'iphone' } })
  f.reset(); f.effects.length = 0
  Header({ staticContent: true })
  for (const effect of f.effects) effect()
  for (const timer of f.timers) timer()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].url, '/api/products?search=iphone&limit=6&fields=search')
})

test('fixed desktop and mobile brand navigation render immediately without loading catalogue brands', () => {
  for (const file of ['components/MegaMenu.tsx', 'components/MobileMenuNavigation.tsx']) {
    const f = fixture()
    const Component = f.loader.load(file).default
    const rendered = nodes(Component({ staticContent: true, categories: [], onNavigate() {} }))
    for (const effect of f.effects) effect()
    assert.equal(f.requests.length, 0)
    assert.ok(f.keys.every(key => key === null))
    assert.ok(rendered.some(node => /brand=APPLE/i.test(node.props.href || '')))
    assert.ok(rendered.some(node => /brand=SAMSUNG/i.test(node.props.href || '')))
  }
})

test('fixed footer and section wrappers skip settings and marketing requests but newsletter submission stays live', async () => {
  const f = fixture()
  const Footer = f.loader.load('components/Footer.tsx').default
  const tree = Footer({ staticContent: true })
  const { MarketingSection, MarketingSections, MarketingStatus } = f.loader.load('components/marketing/MarketingSections.tsx')
  assert.ok(MarketingSection({ page: 'footer', section: 'newsletter', staticContent: true, children: 'Newsletter' }))
  MarketingSections({ page: 'footer', staticContent: true, children: [] })
  assert.equal(MarketingStatus({ page: 'footer', staticContent: true }), null)
  assert.ok(f.keys.every(key => key === null))
  assert.equal(f.requests.length, 0)
  nodes(tree).find(node => node.type === 'input' && node.props.name === 'email').props.onChange({ target: { value: 'fixture@example.invalid' } })
  f.reset()
  const form = nodes(Footer({ staticContent: true })).find(node => node.type === 'form')
  await form.props.onSubmit({ preventDefault() {} })
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].url, '/api/newsletter')
  assert.equal(JSON.parse(f.requests[0].options.body).email, 'fixture@example.invalid')
})

test('managed content hooks retain their existing endpoints and fixed promotions follow the India weekday', async () => {
  const f = fixture()
  f.loader.load('hooks/useSettingsData.ts').useSettingsData()
  f.loader.load('hooks/useMarketingContent.ts').useMarketingContent('header')
  f.loader.load('hooks/useHeaderPromotion.ts').useHeaderPromotion()
  for (const effect of f.effects) effect()
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(f.keys.includes('/api/settings'))
  assert.ok(f.keys.includes('/api/marketing-content'))
  assert.equal(f.requests[0].url, '/api/header-promotions')
  const { homepageHeaderPromotion } = f.loader.load('lib/homepage-chrome.ts')
  assert.equal(homepageHeaderPromotion(new Date('2026-11-07T18:30:00Z')).title, 'SARA Super Sunday')
  assert.equal(homepageHeaderPromotion(new Date('2026-11-08T18:30:00Z')).title, 'Full Moon Day')
  assert.equal(homepageHeaderPromotion(new Date('2026-11-09T18:30:00Z')), null)
})
