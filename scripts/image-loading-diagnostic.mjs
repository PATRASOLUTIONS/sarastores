import fs from 'node:fs/promises'
import { chromium } from 'playwright'

const origin = 'https://www.sarastores.com'
const urls = ['/', '/products', '/product/apple-iphone-16e-512gb-white-6ad1f121467bf9ae32d3649f']
const images = new Set()
for (const path of urls) {
  const response = await fetch(origin + path, { signal: AbortSignal.timeout(30000) })
  const html = await response.text()
  for (const match of html.matchAll(/<img[^>]*src="([^"]+)/g)) images.add(match[1].replaceAll('&amp;', '&'))
  console.log(JSON.stringify({ page: path, status: response.status, images: [...html.matchAll(/<img[^>]*>/g)].length }))
}
for (const source of [...images].slice(0, 10)) {
  const url = new URL(source, origin)
  for (const target of [url.href, ...(url.pathname === '/_next/image' && url.searchParams.get('url')?.startsWith('https:') ? [url.searchParams.get('url')] : [])]) {
    try {
      const response = await fetch(target, { signal: AbortSignal.timeout(20000) })
      console.log(JSON.stringify({ image: target, status: response.status, type: response.headers.get('content-type'), bytes: (await response.arrayBuffer()).byteLength }))
    } catch (error) { console.log(JSON.stringify({ image: target, error: error.message })) }
  }
}
if (process.argv.includes('--browser')) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const failures = []
    await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort())
    page.on('requestfailed', request => { if (request.resourceType() === 'image') failures.push({ url: request.url(), error: request.failure()?.errorText }) })
    await fs.mkdir('documents/private-artifacts', { recursive: true })
    for (const path of urls) {
      await page.goto(origin + path, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(4000)
      await page.evaluate(() => window.scrollTo(0, 700))
      await page.waitForTimeout(2500)
      const state = await page.locator('img').evaluateAll(items => items.slice(0, 30).map(item => ({ alt: item.alt, src: item.currentSrc, loaded: item.complete && item.naturalWidth > 0, width: item.getBoundingClientRect().width, height: item.getBoundingClientRect().height })))
      console.log(JSON.stringify({ browserPage: path, images: state, failures: failures.splice(0) }))
      await page.screenshot({ path: `documents/private-artifacts/live-images-${path === '/' ? 'home' : path === '/products' ? 'products' : 'product'}.png` })
    }
  } finally { await browser.close() }
}
