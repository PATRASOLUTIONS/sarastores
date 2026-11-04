import assert from 'node:assert/strict'
import test from 'node:test'
import { sourceLoader } from './source-loader.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

test('Markdown notices render formatting and Kannada without executing HTML or unsafe links', () => {
  const MarkdownContent = sourceLoader().load('components/ui/MarkdownContent.tsx').default
  const content = '## ನಿಯಮಗಳು\n\n**Approved** and *verified*.\n\n- First\n- Second\n\n[Help](https://example.com/help)\n\n| Gift | Value |\n| --- | --- |\n| Silver | 15000 |\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)'
  const html = renderToStaticMarkup(createElement(MarkdownContent, { content }))
  assert.match(html, /<h2>ನಿಯಮಗಳು<\/h2>/)
  assert.match(html, /<strong>Approved<\/strong>/)
  assert.match(html, /<em>verified<\/em>/)
  assert.match(html, /<li>First<\/li>/)
  assert.match(html, /href="https:\/\/example.com\/help"/)
  assert.match(html, /<table>/)
  assert.doesNotMatch(html, /<script|javascript:/i)
  assert.match(renderToStaticMarkup(createElement(MarkdownContent, { content: 'Existing plain text notice.' })), /Existing plain text notice\./)
})

test('public terms and privacy use the exact saved Markdown for the selected language', () => {
  const { DEFAULT_CONFIG } = sourceLoader().load('lib/diwali/schemas.ts')
  const config = { ...DEFAULT_CONFIG, termsEn: '## English terms\n\n**Approved terms**', termsKn: '## ನಿಯಮಗಳು\n\n**ಅನುಮೋದಿಸಲಾಗಿದೆ**', privacyEn: '## English privacy\n\n- Data notice', privacyKn: '## ಗೌಪ್ಯತೆ\n\n- ಮಾಹಿತಿ' }
  for (const [mode, language, key] of [['terms', 'en', 'termsEn'], ['terms', 'kn', 'termsKn'], ['privacy', 'en', 'privacyEn'], ['privacy', 'kn', 'privacyKn']]) {
    let index = 0
    const loader = sourceLoader({ react: { useEffect() {}, useState(initial) { const current = index++; return [current === 0 ? language : current === 1 ? config : initial, () => {}] } } })
    const MarkdownContent = loader.load('components/ui/MarkdownContent.tsx').default
    const tree = loader.load('components/diwali/PublicGift.tsx').default({ mode })
    let renderedNotice
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit)
      if (!node || typeof node !== 'object' || !node.props) return
      if (node.type === MarkdownContent) renderedNotice = node.props.content
      visit(node.props.children)
    }
    visit(tree)
    assert.equal(renderedNotice, config[key])
  }
})

test('Markdown editor formats selected Kannada text and previews the same source', () => {
  const text = 'ನಿಯಮಗಳು'
  let changed, preview = false
  const editor = { selectionStart: 0, selectionEnd: text.length, focus() {}, setSelectionRange() {} }
  const loader = sourceLoader({ react: { useRef() { return { current: editor } }, useState() { return [preview, value => { preview = value }] } } }, { context: { requestAnimationFrame(callback) { callback() } } })
  const Component = loader.load('components/ui/MarkdownEditor.tsx').default
  const MarkdownContent = loader.load('components/ui/MarkdownContent.tsx').default
  function nodesOf(tree) {
    const nodes = []
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit)
      if (!node || typeof node !== 'object' || !node.props) return
      nodes.push(node); visit(node.props.children)
    }
    visit(tree)
    return nodes
  }
  const props = { id: 'notice', label: 'Kannada terms', value: text, onChange(value) { changed = value } }
  const nodes = nodesOf(Component(props))
  nodes.find(node => node.type === 'button' && node.props.children === 'Bold').props.onClick()
  assert.equal(changed, `**${text}**`)
  nodes.find(node => node.type === 'button' && node.props.children === 'Preview').props.onClick()
  const rendered = nodesOf(Component({ ...props, value: changed })).find(node => node.type === MarkdownContent)
  assert.equal(rendered.props.content, changed)
})

test('Diwali gift engine matches every approved boundary and rejects unconfirmed fractional values', () => {
  const { giftForRupees } = sourceLoader().load('lib/diwali/rules.ts')
  for (const [amount, code] of [[14999, null], [15000, 'silver5'], [25999, 'silver5'], [26000, 'silver10'], [50000, 'silver10'], [50001, 'silver15'], [80000, 'silver15'], [80001, 'silver20'], [100000, 'silver20'], [100001, 'gold1'], [25999.5, null], [NaN, null], [Infinity, null], [-1, null]]) assert.equal(giftForRupees(amount)?.code ?? null, code)
})
test('working-day SLA uses Kolkata dates, excludes approval day and configured holidays', () => {
  const { deliveryDueAt, indiaDate, isRealDate } = sourceLoader().load('lib/diwali/rules.ts')
  const approved = new Date('2026-11-06T20:00:00Z') // Saturday in India.
  assert.equal(indiaDate(approved), '2026-11-07')
  assert.equal(indiaDate(deliveryDueAt(approved, [1, 2, 3, 4, 5], ['2026-11-09'])), '2026-11-18')
  assert.equal(deliveryDueAt(approved, [1, 2, 3, 4, 5], []).toISOString(), '2026-11-17T18:29:59.999Z')
  assert.equal(isRealDate('2026-02-30'), false)
  assert.throws(() => deliveryDueAt(approved, [], []))
})
test('CSV exports escape formulas and quotes', () => {
  const { safeCsv } = sourceLoader().load('lib/diwali/rules.ts')
  assert.equal(safeCsv('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"')
  assert.equal(safeCsv('normal'), '"normal"')
})
test('campaign remains closed without complete bilingual notices and approved policy', () => {
  const { ConfigSchema, DEFAULT_CONFIG, RegistrationSchema } = sourceLoader().load('lib/diwali/schemas.ts')
  assert.equal(ConfigSchema.safeParse(DEFAULT_CONFIG).success, true)
  assert.equal(ConfigSchema.safeParse({ ...DEFAULT_CONFIG, enabled: true }).success, false)
  assert.equal(ConfigSchema.safeParse({ ...DEFAULT_CONFIG, holidays: ['2026-02-30'] }).success, false)
  assert.equal(RegistrationSchema.safeParse({ mobile: '9000000000' }).success, false)
})

test('opening validation identifies every missing approval, store and notice separately', () => {
  const { ConfigSchema, DEFAULT_CONFIG } = sourceLoader().load('lib/diwali/schemas.ts')
  const result = ConfigSchema.safeParse({ ...DEFAULT_CONFIG, enabled: true })
  assert.equal(result.success, false)
  assert.deepEqual(Array.from(result.error.issues, issue => issue.path[0]), ['rulesConfirmed', 'calendarConfirmed', 'stores', 'termsEn', 'termsKn', 'privacyEn', 'privacyKn'])
  assert.equal(ConfigSchema.safeParse({ ...DEFAULT_CONFIG, enabled: false }).success, true)
  const dates = ConfigSchema.safeParse({ ...DEFAULT_CONFIG, campaignEnd: '2026-11-01', registrationEnd: '2026-11-01' })
  assert.deepEqual(Array.from(dates.error.issues, issue => issue.path[0]), ['campaignEnd', 'registrationEnd'])
})

test('settings save highlights missing fields, focuses the first error and supports saving a closed draft', async () => {
  const { DEFAULT_CONFIG } = sourceLoader().load('lib/diwali/schemas.ts')
  const state = [], frames = [], requests = [], scrolled = [], focused = []
  let index = 0
  state[0] = { ...DEFAULT_CONFIG, enabled: true }
  state[1] = { role: 'superadmin', export: true, stores: [] }
  const loader = sourceLoader({
    react: { useEffect() {}, useState(initial) { const current = index++; if (!(current in state)) state[current] = initial; return [state[current], value => { state[current] = typeof value === 'function' ? value(state[current]) : value }] } },
    'next/navigation': { useRouter() { return {} } },
    '@/lib/api-client': { async apiFetch(url, options) { requests.push({ url, options }); return Response.json({ saved: true }) } },
  }, { context: {
    requestAnimationFrame(callback) { frames.push(callback) },
    document: { getElementById(id) { return { scrollIntoView() { scrolled.push(id) }, querySelector() { return { focus() { focused.push(id) } } } } } },
  } })
  const Component = loader.load('components/diwali/AdminGift.tsx').default
  function renderNodes() {
    index = 0
    const nodes = []
    function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object' || !node.props) return; nodes.push(node); visit(node.props.children) }
    visit(Component({ section: 'settings' }))
    return nodes
  }
  let nodes = renderNodes()
  assert.equal(nodes.filter(node => node.type === 'button' && node.props.type === 'submit' && node.props.children === 'Save campaign settings').length, 2)
  await nodes.find(node => node.type === 'form' && node.props.id === 'diwali-settings-form').props.onSubmit({ preventDefault() {} })
  frames.splice(0).forEach(callback => callback())
  assert.equal(requests.length, 0)
  assert.deepEqual(scrolled, ['diwali-rulesConfirmed-section'])
  assert.deepEqual(focused, scrolled)
  nodes = renderNodes()
  const summary = nodes.find(node => node.props.id === 'diwali-settings-errors')
  assert.ok(summary)
  assert.equal(nodes.filter(node => node.type === 'li').length, 7)
  state[0] = { ...state[0], enabled: false }
  nodes = renderNodes()
  await nodes.find(node => node.type === 'form' && node.props.id === 'diwali-settings-form').props.onSubmit({ preventDefault() {} })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].options.json.enabled, false)
  assert.ok(!renderNodes().find(node => node.props.id === 'diwali-settings-errors'))
})

test('API validation returns the setting to highlight', async () => {
  const loader = sourceLoader()
  const { ConfigSchema, DEFAULT_CONFIG } = loader.load('lib/diwali/schemas.ts')
  const { body, errorResponse } = loader.load('lib/diwali/http.ts')
  const request = new Request('https://sara.test/api/admin/diwali/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...DEFAULT_CONFIG, enabled: true }) })
  try { await body(request, ConfigSchema); assert.fail('Incomplete open configuration must be rejected') } catch (error) {
    const response = errorResponse(error)
    assert.equal(response.status, 400)
    assert.equal((await response.json()).field, 'rulesConfirmed')
  }
})

test('gift stock accepts a quantity without a procurement reference and still validates quantities', () => {
  const { StockSchema } = sourceLoader().load('lib/diwali/schemas.ts')
  const parsed = StockSchema.parse({ giftCode: 'silver5', quantity: 10 })
  assert.equal(parsed.note, '')
  assert.equal(StockSchema.safeParse({ giftCode: 'silver5', quantity: 10, note: '' }).success, true)
  for (const quantity of [0, -1, 1.5, 100001]) assert.equal(StockSchema.safeParse({ giftCode: 'silver5', quantity }).success, false)
})

test('customers can enter gift details before OTP verification but cannot submit them', async () => {
  const { DEFAULT_CONFIG } = sourceLoader().load('lib/diwali/schemas.ts')
  let index = 0, error = ''
  const react = {
    useEffect() {},
    useState(initial) {
      const current = index++
      return [current === 1 ? { ...DEFAULT_CONFIG, enabled: true, registrationStart: '2000-01-01', registrationEnd: '2099-12-31' } : initial, value => { if (current === 2) error = value }]
    },
  }
  const loader = sourceLoader({ react })
  const Component = loader.load('components/diwali/PublicGift.tsx').default
  const GiftRegistration = loader.load('components/diwali/GiftRegistration.tsx').default
  const tree = Component({ mode: 'register' })
  const nodes = []
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object' || !node.props) return
    nodes.push(node)
    if (node.type === GiftRegistration) visit(GiftRegistration(node.props))
    visit(node.props.children)
  }
  visit(tree)
  assert.equal(nodes.find(node => node.type === 'fieldset').props.disabled, false)
  for (const name of ['name', 'email', 'address', 'city', 'district', 'pincode', 'storeCode', 'invoice', 'accuracy']) {
    assert.equal(nodes.find(node => node.props.name === name)?.props.required, true, `${name} must remain required`)
  }
  assert.equal(nodes.filter(node => node.type === 'nav' || node.type === 'footer').length, 0)
  assert.equal(nodes.find(node => node.type === 'button' && node.props.children === 'Submit registration').props.disabled, true)
  let prevented = false
  await nodes.find(node => node.type === 'form').props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.match(error, /Verify your mobile number/)
})
test('campaign permissions separate verification, fulfilment, management and export', () => {
  const { authorize } = sourceLoader().load('lib/diwali/service.ts')
  const config = { staff: [{ userId: 'v', role: 'verifier', export: false, stores: ['A'] }, { userId: 'f', role: 'fulfilment', export: false, stores: [] }, { userId: 'm', role: 'management', export: false, stores: [] }] }
  const user = id => ({ id, role: 'user', dashboardAccess: true, allowedPages: ['/admin/diwali'] })
  assert.equal(authorize(user('v'), config, 'verify').role, 'verifier')
  assert.throws(() => authorize(user('v'), config, 'fulfil'), /permission/)
  assert.throws(() => authorize(user('m'), config, 'verify'), /permission/)
  assert.throws(() => authorize(user('m'), config, 'export'), /permission/)
  assert.throws(() => authorize(user('unknown'), config, 'view'), /access denied/)
  assert.throws(() => authorize({ ...user('v'), allowedPages: ['/admin/orders'] }, config, 'view'), /access denied/)
})
test('customer registration rejects cross-site requests before reading any credentials', async () => {
  const { POST } = sourceLoader().load('app/api/diwali/register/route.ts')
  const result = await POST(new Request('https://sara.test/api/diwali/register', { method: 'POST', headers: { origin: 'https://attacker.test', 'Content-Type': 'application/json' }, body: '{}' }))
  assert.equal(result.status, 403)
})
test('unsigned WhatsApp callbacks cannot mutate message status', async () => {
  const loader = sourceLoader({}, { env: { DIWALI_WEBHOOK_SECRET: 'synthetic-test-webhook-secret' } })
  const { POST } = loader.load('app/api/webhooks/diwali/whatsapp/route.ts')
  const result = await POST(new Request('https://sara.test/api/webhooks/diwali/whatsapp', { method: 'POST', body: JSON.stringify({ entry: [] }) }))
  assert.equal(result.status, 401)
})
