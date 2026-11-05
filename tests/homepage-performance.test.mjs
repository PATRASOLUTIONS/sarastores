import assert from 'node:assert/strict'
import test from 'node:test'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import fs from 'node:fs'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { Binary } from 'mongodb'
import { sourceLoader } from './source-loader.mjs'

const imageId = 'a'.repeat(32)
const products = Array.from({ length: 120 }, (_, i) => ({
  id: String(i), name: 'Product ' + i, stock: 3, price: 1000 + i,
  image: '/fixture.webp', category: 'Mobile', raw: { internal: 'must not ship' },
  reviews: { average: 4.5, count: 2 }, description: 'x'.repeat(10000),
}))

test('home deals contain six unique available cards and omit catalogue/detail payloads', async () => {
  const loader = sourceLoader({ '@/lib/public-page-data': { getHomepageProductPool: async () => [
    ...products, { ...products[0], id: 'duplicate' }, { ...products[1], id: 'sold-out', name: 'Sold out', stock: 0 },
  ] } })
  const { getHomepageDeals } = loader.load('lib/homepage-data.ts')
  for (let i = 0; i < 10; i++) {
    const deals = await getHomepageDeals()
    assert.equal(deals.length, 6)
    assert.equal(new Set(deals.map(product => product.name)).size, 6)
    assert.ok(deals.every(product => product.stock > 0 && !('raw' in product) && !('description' in product)))
    assert.ok(Buffer.byteLength(JSON.stringify(deals)) < 3000)
  }
})

test('homepage product query samples a bounded pool and retains public visibility and numeric stock checks', async () => {
  let pipeline
  const loader = sourceLoader({
    '@/lib/db-service': { getCollection: async () => ({ aggregate: value => { pipeline = value; return { toArray: async () => [] } } }) },
    '@/lib/public-catalogue': { publicCatalogueFilter: async () => ({ fixturePublic: true }) },
  })
  assert.equal((await loader.load('lib/public-page-data.ts').getHomepageProductPool()).length, 0)
  assert.equal(pipeline[0].$match.$and[0].fixturePublic, true)
  assert.equal(pipeline[1].$sample.size, 120)
  assert.equal(pipeline[0].$match.$and[1].$expr.$and.length, 2)
  assert.ok(pipeline[2].$project.images.$slice[0].$cond)
})

function htmlFixture(content) {
  return sourceLoader({
    '@/components/Header': { __esModule: true, default: () => React.createElement('header', null, 'Header') },
    '@/components/Footer': { __esModule: true, default: () => React.createElement('footer', null, 'Footer') },
    '@/components/home/EcommerceLaunch': { default: () => null },
    'next/dynamic': { __esModule: true, default: () => () => null },
    '@/components/AddToCartButton': { __esModule: true, default: () => React.createElement('button', null, 'Add to cart') },
    '@/components/CompareProductButton': { __esModule: true, default: () => React.createElement('button', null, 'Compare') },
    '@/hooks/useRecentlyViewed': { useRecentlyViewed: () => ({ products: [] }) },
    '@/hooks/useSettingsData': { useSettingsData: () => ({ data: undefined }) },
    '@/lib/homepage-data': { getHomepageContent: async () => content, getHomepageDeals: async () => products.slice(0, 6).map(({ raw, description, ...product }) => product) },
    '@/lib/seo-metadata': {}, '@/lib/homepage-banner': {},
    '@/components/home/landing/homepage.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) },
  })
}

const now = Date.parse('2026-11-05T10:00:00Z')
const banner = { id: 'hero', placement: 'home-hero', title: '', active: true, image: '/api/banner-images/' + imageId, imageWidth: 1256, imageHeight: 793, ctaLink: '/products' }
const content = { banners: [banner], marketing: { sections: [] }, stockedBrands: [{ name: 'Apple', count: 1 }], brandDocs: [], storeCount: 2 }

test('first server HTML contains the banner, responsive preload, top brands and all six deals', async () => {
  const loader = htmlFixture(content)
  const Home = loader.load('app/page.tsx').default
  const html = renderToStaticMarkup(await Home())
  assert.match(html, /rel="preload"[^>]*as="image"[^>]*imageSrcSet=/i)
  assert.match(html, /src="\/api\/banner-images\/[a-f0-9]{32}\?w=800"/)
  assert.match(html, /fetchPriority="high"/i)
  assert.match(html, /width="1256" height="793"/)
  assert.match(html, /Shop featured offers/)
  assert.match(html, /Top Brands/)
  const brandHtml = html.match(/<section class="brands" aria-label="Top Brands">([\s\S]*?)<\/section>/)[1]
  assert.deepEqual([...brandHtml.matchAll(/<span>([^<]+)<\/span>/g)].map(match => match[1]), ['realme', 'OPPO', 'Mi', 'Samsung', 'Vivo', 'Apple'])
  assert.ok(html.indexOf('Top Brands') < html.indexOf('id="deals-of-the-day"'))
  assert.doesNotMatch(brandHtml, /View All/)
  assert.match(brandHtml, /brand=MI/)
  const { HomepageBrands } = loader.load('components/home/landing/HomepageSections.tsx')
  assert.ok(HomepageBrands().props.children[1].props.children.every(link => link.props.prefetch === true))
  assert.equal((html.match(/class="productCard"/g) || []).length, 6)
  assert.doesNotMatch(html, /Loading deals/)
  assert.doesNotMatch(html, /internal|must not ship/)
})

test('server banner selection respects future starts and expired deadlines while retaining reserved space', () => {
  const loader = htmlFixture(content)
  const Hero = loader.load('components/home/landing/LandingHero.tsx').default
  const html = renderToStaticMarkup(React.createElement(Hero, { initialNow: now, initialBanners: [
    { ...banner, expiresAt: new Date(now).toISOString() },
    { ...banner, id: 'future', startsAt: new Date(now + 1000).toISOString() },
  ] }))
  assert.doesNotMatch(html, /<img/)
  assert.match(html, /class="hero"/)
})

test('banner variants preserve originals, resize mobile images, cache reads and reject arbitrary widths', async () => {
  const original = await sharp({ create: { width: 1800, height: 720, channels: 3, background: '#1462a4' } }).webp({ quality: 85 }).toBuffer()
  let reads = 0
  const loader = sourceLoader({ '@/lib/banner-images': { readBannerImage: async () => { reads++; return { data: new Binary(original), contentType: 'image/webp', bytes: original.length } } } })
  const { GET } = loader.load('app/api/banner-images/[id]/route.ts')
  const request = query => GET(new Request('https://www.sarastores.com/api/banner-images/' + imageId + query), { params: Promise.resolve({ id: imageId }) })
  const untouched = await request('')
  assert.deepEqual(Buffer.from(await untouched.arrayBuffer()), original)
  const resized = await request('?w=480')
  assert.equal(resized.status, 200)
  const data = Buffer.from(await resized.arrayBuffer())
  const meta = await sharp(data).metadata()
  assert.equal(meta.width, 480)
  assert.equal(meta.height, 192)
  assert.equal(meta.format, 'webp')
  assert.ok(data.length < original.length)
  assert.match(resized.headers.get('Cache-Control'), /immutable/)
  await request('?w=480')
  assert.equal(reads, 2)
  for (const query of ['?w=1', '?w=99999', '?w=NaN', '?w=0480', '?w=']) assert.equal((await request(query)).status, 400)
  assert.equal(reads, 2)
})

test('responsive banner URLs cannot resize protected routes or third-party assets', () => {
  const { bannerImageSources } = sourceLoader().load('lib/banner-image-sources.ts')
  assert.ok(bannerImageSources('/api/banner-images/' + imageId).srcSet.includes('480w'))
  const sized = bannerImageSources('/api/banner-images/' + imageId, 1256)
  assert.ok(sized.srcSet.includes('1256w'))
  assert.ok(!sized.srcSet.includes('1280w'))
  assert.ok(bannerImageSources('https://www.sarastores.com/api/banner-images/' + imageId))
  for (const source of ['/api/private/' + imageId, '/api/banner-images/invalid', 'https://evil.example/api/banner-images/' + imageId, 'https://www.sarastores.com.evil.example/api/banner-images/' + imageId]) assert.equal(bannerImageSources(source), null)
})


test('public home content is cached, validated and carries image dimensions without loading image bytes', async () => {
  const reads = []
  const rows = {
    listing_banners: [{ ...banner, _id: 'hero' }], marketing_content: [],
    brands: [{ name: 'Apple', logo: '/apple.webp' }],
    banner_images: [{ _id: imageId, width: 1256, height: 793 }],
  }
  const loader = sourceLoader({
    '@/lib/public-page-data': { getHomepageCatalogueFilter: async () => ({ active: true }) },
    '@/lib/db-service': {
      normalizeId: row => { const { _id, ...rest } = row; return { ...rest, id: String(_id) } },
      getCollection: async name => {
        assert.ok(!['products', 'brands'].includes(name), 'fixed brands must not load a catalogue or brand collection')
        return ({
        find(filter, options) { reads.push({ name, filter, options }); const cursor = { sort: () => cursor, toArray: async () => rows[name] }; return cursor },
        countDocuments: async () => 2,
        aggregate: () => ({ toArray: async () => [{ name: 'Apple', count: 2 }] }),
      }) },
    },
  })
  const { getHomepageContent } = loader.load('lib/homepage-data.ts')
  const result = await getHomepageContent()
  assert.equal(result.banners[0].imageWidth, 1256)
  assert.equal(result.banners[0].imageHeight, 793)
  assert.equal(result.storeCount, 2)
  assert.deepEqual(Object.keys(reads.find(row => row.name === 'banner_images').options.projection).sort(), ['height', 'width'])
  result.banners.length = 0
  assert.equal((await getHomepageContent()).banners.length, 1)
  assert.equal(reads.filter(row => row.name === 'listing_banners').length, 1)
})

test('Tailwind 3 still supplies dialog/menu animations after the unused Tailwind 4 stylesheet is removed', async () => {
  const config = sourceLoader().load('tailwind.config.ts').default
  const css = await postcss([tailwindcss({ ...config, content: [{ raw: 'animate-in animate-out fade-in-0 zoom-in-95 slide-in-from-top-2' }] })]).process('@tailwind utilities;', { from: undefined })
  for (const name of ['animate-in', 'animate-out', 'fade-in-0', 'zoom-in-95', 'slide-in-from-top-2']) assert.ok(css.css.includes('.' + name))
  assert.ok(!fs.readFileSync('app/globals.css', 'utf8').includes('@import "tw-animate-css"'))
})


test('closed cart chrome loads neither drawer nor desktop cart UI; first opening retains exit behavior', () => {
  const dynamicComponents = [], effects = [], states = []
  let slot = 0, open = false, closed = 0
  const loader = sourceLoader({
    react: { ...React,
      useState(initial) { const key = slot++; if (!(key in states)) states[key] = initial; return [states[key], value => { states[key] = value }] },
      useEffect: callback => effects.push(callback),
    },
    'next/dynamic': Object.assign((_loader, options) => { const component = () => null; dynamicComponents.push({ component, options }); return component }, { __esModule: false }),
    '@/contexts/CartUIContext': { useCartUI: () => ({ isOpen: open, closeCart: () => { open = false; closed++ } }) },
    '@/hooks/useCart': { useCart: () => ({ cart: [] }) },
    '@/contexts/AuthContext': { useAuth: () => ({ user: null }) },
  }, { context: { window: { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) } } })
  const Chrome = loader.load('components/LazyCartChrome.tsx').default
  const render = () => { slot = 0; return Chrome() }
  assert.ok(render().props.children.every(child => !child))
  for (const effect of effects.splice(0)) effect()
  open = true
  assert.equal(render().props.children[0].type, dynamicComponents[0].component)
  for (const effect of effects.splice(0)) effect()
  const Loading = dynamicComponents[0].options.loading
  const loading = Loading()
  assert.equal(loading.props.role, 'dialog')
  loading.props.children.props.children[0].props.onClick()
  assert.equal(closed, 1)
  assert.equal(Loading(), null)
  assert.equal(render().props.children[0].type, dynamicComponents[0].component)
})
