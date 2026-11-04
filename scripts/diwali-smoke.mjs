import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { MongoClient, ObjectId } from 'mongodb'
import { chromium } from '@playwright/test'
import { sourceLoader } from '../tests/source-loader.mjs'

// Opt-in browser QA: a fresh database, synthetic account, mocked OTP transport,
// and an isolated dev server. No production build or real WhatsApp sends.
assert.match(process.env.DIWALI_TEST_DATABASE || '', /^sara_diwali_isolated_test_[a-zA-Z0-9_]+$/)
assert.ok(process.env.SESSION_SECRET)
assert.ok(process.env.DIWALI_TEST_MONGODB_URI, 'Configure the dedicated isolated test-cluster URI, not the app MONGODB_URI')
const databaseName = `sara_diwali_browser_${randomUUID().replaceAll('-', '').slice(0, 10)}`
const client = new MongoClient(process.env.DIWALI_TEST_MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
const port = Number(process.env.DIWALI_SMOKE_PORT || 3011), origin = `http://localhost:${port}`
const root = process.cwd(), artifacts = path.join(root, 'documents/private-artifacts/diwali')
let server, browser
const serverLog = []
const failures = []
try {
  await client.connect()
  const db = client.db(databaseName), loader = sourceLoader({}, { env: { SESSION_SECRET: process.env.SESSION_SECRET } })
  const { DEFAULT_CONFIG } = loader.load('lib/diwali/schemas.ts')
  await db.collection('diwali_config').insertOne({ ...DEFAULT_CONFIG, _id: '2026', enabled: true, rulesConfirmed: true, calendarConfirmed: true, registrationStart: '2000-01-01', registrationEnd: '2099-12-31', stores: [{ code: 'QA', name: 'Synthetic QA store' }], termsEn: 'Synthetic test terms', termsKn: 'ಪರೀಕ್ಷಾ ನಿಯಮಗಳು', privacyEn: 'Synthetic test privacy notice', privacyKn: 'ಪರೀಕ್ಷಾ ಗೌಪ್ಯತೆ ಸೂಚನೆ' })
  const challenge = randomUUID(), code = '123456'
  await db.collection('diwali_otp').insertOne({ _id: challenge, mobile: '9000000099', ready: true, attempts: 0, otpHash: createHmac('sha256', process.env.SESSION_SECRET).update(`${challenge}:${code}`).digest('hex'), expiresAt: new Date(Date.now() + 15 * 60000) })
  const adminId = new ObjectId().toHexString()
  await db.collection('users').insertOne({ _id: new ObjectId(adminId), name: 'Synthetic QA administrator', email: 'diwali-qa@example.invalid', role: 'admin', status: 'active', sessionVersion: 0 })
  const sessionToken = await loader.load('lib/session.ts').createSessionToken({ id: adminId, email: 'diwali-qa@example.invalid', name: 'Synthetic QA administrator', role: 'admin', sessionVersion: 0 })
  await fs.mkdir(artifacts, { recursive: true })
  server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(port)], { cwd: root, windowsHide: true, env: { ...process.env, MONGODB_URI: process.env.DIWALI_TEST_MONGODB_URI, MONGODB_DB: databaseName, DB_NAME: databaseName, NEXT_DIST_DIR: '.next-diwali-test', SESSION_SECRET: process.env.SESSION_SECRET, DIWALI_MESSAGING_ENABLED: 'false', WHATSAPP_CAMPAIGNS_ENABLED: 'false', ASKEVA_API_KEY: '', ASKEVA_API_URL: '', NEXT_PUBLIC_SITE_URL: origin, NEXT_PUBLIC_APP_URL: origin, NEXTAUTH_URL: origin, RATE_LIMIT_BACKEND: 'mongodb', NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] })
  server.stdout.on('data', chunk => serverLog.push(String(chunk)))
  server.stderr.on('data', chunk => serverLog.push(String(chunk)))
  let ready = false
  for (let attempt = 0; attempt < 180; attempt++) {
    if (server.exitCode !== null) throw new Error('Isolated Next.js dev server exited')
    try { if ((await fetch(`${origin}/api/diwali/config`, { signal: AbortSignal.timeout(2000) })).ok) { ready = true; break } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert.ok(ready, 'Isolated dev server did not become ready')
  console.log('Isolated Next.js server ready; testing public registration')
  browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: process.env.DIWALI_BROWSER_CHANNEL || 'chrome' } : {}) })
  if (process.argv.includes('--admin-only')) {
    await db.collection('diwali_claims').insertOne({ _id: randomUUID(), reference: `SARA-DIW-${randomUUID().slice(0, 8)}`, mobile: '9000000099', name: 'Synthetic browser customer', address: 'Synthetic address 123', city: 'QA city', district: 'QA district', pincode: '560001', invoice: 'QA-BROWSER-001', invoiceKey: 'QA:QA-BROWSER-001', requestKey: randomUUID(), storeCode: 'QA', enteredValue: 55000, language: 'en', whatsappConsent: true, status: 'pending', fulfilment: 'pending', version: 0, createdAt: new Date(), updatedAt: new Date() })
    console.log('Synthetic admin fixture ready; testing dashboard and invoice approval')
  } else {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }), page = await context.newPage()
  page.on('pageerror', error => { failures.push(error.message); console.error('Browser runtime error:', error.message) })
  page.on('requestfailed', request => { if (request.url().startsWith(origin)) console.error('Local browser request failed:', new URL(request.url()).pathname, request.failure()?.errorText) })
  await page.route('**/api/diwali/otp/send', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ challenge }) }))
  assert.equal((await context.request.get(`${origin}/api/admin/diwali/registrations`)).status(), 401)
  await page.goto(`${origin}/diwali-gift`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.getByRole('heading', { name: 'Register Your Diwali Gift' }).waitFor({ timeout: 120000 })
  // The storefront consent banner is outside the campaign; dismiss if presented.
  const essential = page.getByRole('button', { name: /essential only|reject optional|necessary only|reject all/i })
  if (await essential.count()) await essential.first().click()
  await page.getByLabel('Mobile number', { exact: true }).fill('9000000099')
  await page.getByRole('button', { name: 'Send verification code', exact: true }).click()
  await page.getByLabel('Six-digit code sent on WhatsApp').fill(code)
  await page.getByRole('button', { name: 'Verify mobile', exact: true }).click()
  await page.getByText('Mobile verified', { exact: false }).waitFor()
  console.log('Real OTP verification passed; completing the customer form')
  await page.getByLabel('Full name', { exact: true }).fill('Synthetic browser customer')
  await page.getByLabel('Complete delivery address', { exact: true }).fill('Synthetic address 123, QA Road')
  await page.getByLabel('City', { exact: true }).fill('QA city')
  await page.getByLabel('District', { exact: true }).fill('QA district')
  await page.getByLabel('PIN code', { exact: true }).fill('560001')
  await page.getByLabel('Invoice store', { exact: true }).selectOption('QA')
  await page.getByLabel('Invoice number', { exact: true }).fill('QA-BROWSER-001')
  await page.getByLabel('Invoice value in rupees', { exact: true }).fill('55000')
  await page.getByLabel('I confirm my details and invoice are genuine.').check()
  await page.getByLabel('I agree to receive WhatsApp updates about my registration and gift delivery.').check()
  await page.screenshot({ path: path.join(artifacts, 'public-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Submit registration', exact: true }).click()
  await page.getByRole('heading', { name: 'Registration received' }).waitFor({ timeout: 30000 })
  assert.equal(await db.collection('diwali_claims').countDocuments({ invoice: 'QA-BROWSER-001', status: 'pending' }), 1)
  assert.equal(await db.collection('diwali_messages').countDocuments({}), 0)
  await page.goto(`${origin}/diwali-gift/status`)
  await page.getByText('Pending SARA verification', { exact: true }).waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: 'ಕನ್ನಡ', exact: true }).click()
  await page.getByRole('heading', { name: 'ನಿಮ್ಮ ಉಡುಗೊರೆಯ ಸ್ಥಿತಿ' }).waitFor()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(artifacts, 'public-kannada-mobile.png'), fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Public mobile page overflows horizontally')
  console.log('Public registration, secure status and Kannada mobile checks passed')
  await context.close()
  }
  const admin = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  await admin.addCookies([{ name: 'session', value: sessionToken, url: origin, httpOnly: true, sameSite: 'Lax' }])
  const adminPage = await admin.newPage()
  adminPage.on('pageerror', error => failures.push(error.message))
  await adminPage.goto(`${origin}/admin/diwali`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await adminPage.getByRole('heading', { name: 'Diwali gift management' }).waitFor({ timeout: 90000 })
  await adminPage.getByText('Pending verification', { exact: true }).waitFor({ timeout: 120000 })
  const adminConsent = adminPage.getByRole('button', { name: /reject all/i })
  if (await adminConsent.count()) await adminConsent.first().click()
  await adminPage.screenshot({ path: path.join(artifacts, 'admin-dashboard.png'), fullPage: true })
  await adminPage.goto(`${origin}/admin/diwali/registrations`)
  await adminPage.getByRole('row').filter({ hasText: 'QA-BROWSER-001' }).waitFor({ timeout: 120000 })
  await adminPage.getByRole('link', { name: 'Open claim', exact: true }).click()
  await adminPage.getByLabel('Verified invoice value', { exact: true }).fill('26000')
  await adminPage.getByLabel('Verified invoice date', { exact: true }).fill('2026-11-05')
  await adminPage.getByLabel('Invoice matched to the stated store and is not cancelled, voided or refunded.').check()
  await adminPage.getByLabel('Review / exception / resolution note', { exact: true }).fill('Synthetic browser POS verification')
  await adminPage.getByRole('button', { name: 'Approve and allocate gift', exact: true }).click()
  await adminPage.getByText('Claim updated and audit recorded.', { exact: true }).waitFor({ timeout: 30000 })
  const claim = await db.collection('diwali_claims').findOne({ invoice: 'QA-BROWSER-001' })
  assert.equal(claim.giftCode, 'silver10'); assert.equal(claim.status, 'approved')
  assert.equal(await db.collection('diwali_messages').countDocuments({ claimId: claim._id }), 1)
  assert.equal(failures.length, 0, `Browser errors: ${failures.join('; ')}`)
  console.log('Admin dashboard, verification queue and verified-value approval checks passed')
} catch (error) {
  if (failures.length) console.error('Captured browser runtime errors:', failures.join('; '))
  if (browser) {
    const pages = browser.contexts().flatMap(context => context.pages())
    if (pages.length) await pages[pages.length - 1].screenshot({ path: path.join(artifacts, 'failure.png'), fullPage: true }).catch(() => {})
  }
  throw error
} finally {
  if (browser) await browser.close()
  if (server?.pid && server.exitCode === null) {
    if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }) } catch {} }
    else server.kill('SIGTERM')
  }
  await fs.mkdir(artifacts, { recursive: true })
  await fs.writeFile(path.join(artifacts, 'dev-server.log'), serverLog.join(''))
  try { assert.match(databaseName, /^sara_diwali_browser_[a-f0-9]{10}$/); await client.db(databaseName).dropDatabase() } finally { await client.close() }
}
