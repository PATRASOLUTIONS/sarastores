import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import QRCode from 'qrcode'
import { chromium } from 'playwright'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { sourceLoader } from '../tests/source-loader.mjs'

test('store poster keeps the tracked QR in the white panel and celebration honours reduced motion', async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 1000 } })
    const template = await fs.readFile('public/diwali-store-poster.webp')
    const url = 'https://sarastores.com/diwali-gift/store/synthetic-store-token'
    const code = await QRCode.toDataURL(url, { width: 540, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } })
    const source = ts.transpileModule(await fs.readFile('lib/diwali/store-poster.ts', 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText
    await page.route('https://fixture.test/diwali-store-poster.webp', route => route.fulfill({ body: template, contentType: 'image/webp' }))
    await page.route('https://fixture.test/', route => route.fulfill({ body: '<html><body></body></html>', contentType: 'text/html' }))
    await page.goto('https://fixture.test/')
    const poster = await page.evaluate(async ({ source, code, url }) => {
      const exports = {}, requests = []
      const require = () => ({ toDataURL: async (value, options) => { requests.push({ value, options }); return code } })
      new Function('require', 'exports', source)(require, exports)
      const result = await exports.createStorePoster({ url, name: 'SARA Synthetic Store', code: 'SYNTH' })
      const image = new Image(); image.src = result; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      return { result, requests, size: [image.width, image.height], quietZone: [...context.getImageData(350, 450, 1, 1).data] }
    }, { source, code, url })
    assert.equal(poster.requests[0].value, url)
    assert.equal(poster.requests[0].options.margin, 4)
    assert.deepEqual(poster.size, [1199, 1312])
    assert.deepEqual(poster.quietZone, [255, 255, 255, 255])
    await fs.mkdir('documents/private-artifacts', { recursive: true })
    await fs.writeFile('documents/private-artifacts/diwali-store-poster-preview.png', Buffer.from(poster.result.split(',')[1], 'base64'))
    const Celebration = sourceLoader().load('components/diwali/RegistrationCelebration.tsx').default
    const html = renderToStaticMarkup(React.createElement(Celebration, { language: 'en' }, React.createElement('p', null, 'Synthetic reference: DEMO-123')))
    const css = await postcss([tailwindcss({ content: [{ raw: html, extension: 'html' }] })]).process('@tailwind base; @tailwind components; @tailwind utilities;', { from: undefined })
    await page.setContent(`<style>${css.css}</style><div class="min-h-screen bg-stone-50 p-4">${html}</div>`)
    assert.match(await page.locator('h1').innerText(), /Congratulations/)
    assert.match(await page.locator('section').innerText(), /after SARA verifies your invoice/)
    assert.equal(await page.locator('.diwali-gold-coin').count(), 24)
    assert.equal(await page.locator('.diwali-silver-coin').count(), 24)
    await page.waitForTimeout(600)
    const motion = await page.locator('.diwali-falling-coin').first().evaluate(item => ({ transform: getComputedStyle(item).transform, iterations: getComputedStyle(item).animationIterationCount }))
    assert.notEqual(motion.transform, 'none')
    assert.equal(motion.iterations, '1')
    await page.screenshot({ path: 'documents/private-artifacts/diwali-registration-celebration.png' })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    assert.equal(await page.locator('.diwali-coin-shower').evaluate(item => getComputedStyle(item).display), 'none')
    const kannada = renderToStaticMarkup(React.createElement(Celebration, { language: 'kn' }, 'DEMO-123'))
    assert.match(kannada, /ಅಭಿನಂದನೆಗಳು/)
  } finally { await browser.close() }
})
