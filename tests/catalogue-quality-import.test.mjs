import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { ObjectId } from 'mongodb'
import { sourceLoader } from './source-loader.mjs'
import * as React from 'react'

const id = '0123456789abcdef01234567'
const product = (extra = {}) => ({ _id: id, itemno: '000042', sku: '000042', name: '', price: 100, mrp: 150, stock: 0, ...extra })
const row = (values, number = 2) => ({ row: number, values })
const isRegex = value => Object.prototype.toString.call(value) === '[object RegExp]'
function workbook(rows, mutate) {
  const book = XLSX.utils.book_new(), sheet = XLSX.utils.aoa_to_sheet(rows)
  mutate?.(sheet)
  XLSX.utils.book_append_sheet(book, sheet, 'Missing data')
  return Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))
}
// Small Mongo expression interpreter for fixture matching, including literal dotted
// headers. The service still executes its actual query and transaction code.
function expr(value, doc, variables = {}) {
  if (typeof value === 'string' && value.startsWith('$$')) return value === '$$ROOT' ? doc : variables[value.slice(2)]
  if (typeof value === 'string' && value.startsWith('$')) return value.slice(1).split('.').reduce((data, part) => data?.[part], doc)
  if (Array.isArray(value)) return value.map(entry => expr(entry, doc, variables))
  if (!value || typeof value !== 'object' || value instanceof ObjectId || isRegex(value)) return value
  if (!Object.keys(value).length) return value
  if ('$literal' in value) return value.$literal
  if ('$convert' in value) return String(expr(value.$convert.input, doc, variables) ?? '')
  if ('$trim' in value) return expr(value.$trim.input, doc, variables).trim()
  if ('$toLower' in value) return expr(value.$toLower, doc, variables).toLowerCase()
  if ('$type' in value) { const result = expr(value.$type, doc, variables); return result && typeof result === 'object' && !Array.isArray(result) ? 'object' : typeof result }
  if ('$eq' in value) { const [a, b] = expr(value.$eq, doc, variables); return a === b }
  if ('$cond' in value) return expr(value.$cond[expr(value.$cond[0], doc, variables) ? 1 : 2], doc, variables)
  if ('$getField' in value) return expr(value.$getField.input, doc, variables)?.[expr(value.$getField.field, doc, variables)]
  if ('$in' in value) { const [a, b] = expr(value.$in, doc, variables); return b.some(entry => isRegex(entry) ? entry.test(String(a)) : String(entry) === String(a)) }
  if ('$map' in value) return expr(value.$map.input, doc, variables).map(entry => expr(value.$map.in, doc, { ...variables, [value.$map.as]: entry }))
  if ('$anyElementTrue' in value) return expr(value.$anyElementTrue[0], doc, variables).some(Boolean)
  if ('$or' in value) return value.$or.some(entry => expr(entry, doc, variables))
  throw new Error('Unsupported fixture expression')
}
function matches(query, doc) {
  if (query.$or) return query.$or.some(clause => matches(clause, doc))
  if (query.$expr) return expr(query.$expr, doc)
  return Object.entries(query).every(([field, condition]) => expr({ $in: ['$' + field, condition.$in] }, doc))
}
function harness(initial = [product()], options = {}) {
  let products = initial.map(value => ({ ...value })), writes = 0, sessions = 0, transactions = 0, ended = 0
  const session = {
    async withTransaction(callback) {
      transactions++
      const previous = products.map(value => ({ ...value }))
      try { return await callback() } catch (error) { products = previous; throw error }
    },
    async endSession() { ended++ },
  }
  const collection = {
    async countDocuments(query) { return products.filter(value => matches(query, value)).length },
    find(query) { let limit = Infinity, offset = 0; const cursor = { sort() { return cursor }, skip(value) { offset = value; return cursor }, limit(value) { limit = value; return cursor }, async toArray() { return products.filter(value => matches(query, value)).slice(offset, offset + limit).map(value => ({ ...value })) } }; return cursor },
    async bulkWrite(operations, settings) {
      assert.equal(settings.session, session); assert.equal(settings.ordered, true)
      for (const operation of operations) {
        writes++
        assert.equal(operation.updateOne.upsert, false)
        const current = products.find(value => String(value._id) === String(operation.updateOne.filter._id))
        Object.assign(current, operation.updateOne.update.$set)
        if (options.failWrite && writes >= (options.failAfter || 1)) throw new Error('Synthetic transaction write failure')
      }
      return { matchedCount: operations.length }
    },
  }
  const loader = sourceLoader({
    '@/lib/db-service': { getCollection: async name => name === 'products' ? collection : {
      find(query) { return { limit() { return this }, async toArray() { return (options.specs || []).filter(value => matches(query, value)) } } },
    } },
    '@/lib/mongodb': { connectToDatabase: async () => ({ client: { startSession() { sessions++; return session } } }) },
    '@/lib/auth': { requireFullAdmin: async () => options.denied ? { ok: false, response: new Response('{}', { status: 403 }) } : { ok: true, user: { id: 'fixture-admin', role: 'admin' } } },
  }, { context: { File, console: { ...console, error() {} } } })
  return { loader, api: loader.load('lib/catalogue-quality-import.ts'), products: () => products,
    counts: () => ({ writes, sessions, transactions, ended }), replace(value) { products = value } }
}

test('Excel preserves leading-zero item numbers, aliases, original row numbers and optional blanks', () => {
  const fx = harness(), bytes = workbook([['Item No.', 'Product Name', 'EAN Number', 'GST'], ['000042', 'Verified appliance name', '', '18%'], ['', '', '', ''], ['000043', '', '', '']])
  const rows = fx.api.readQualityImport(bytes)
  assert.equal(rows[0].values.itemno, '000042'); assert.equal(rows[0].values.name, 'Verified appliance name')
  assert.equal(rows[0].values['gst rate'], '18%'); assert.equal(rows[1].row, 4)
  assert.equal(Object.hasOwn(rows[0].values, 'gtin'), false)
})
test('Excel rejects formulas, duplicate aliases, unknown columns, excessive rows and cells', () => {
  const { readQualityImport } = harness().api
  assert.throws(() => readQualityImport(workbook([['itemno', 'name'], ['000042', 'Fixture']], sheet => { sheet.B2.f = 'SUM(1,2)' })), /formulas/)
  assert.throws(() => readQualityImport(workbook([['itemno', 'SKU'], ['000042', '000042']])), /Repeated column/)
  assert.throws(() => readQualityImport(workbook([['itemno', 'constructor'], ['000042', 'bad']])), /Unsupported column/)
  assert.throws(() => readQualityImport(workbook([['name'], ['Fixture product']])), /itemno or product id/)
  assert.throws(() => readQualityImport(workbook([['itemno'], ...Array.from({ length: 501 }, (_, n) => [String(n)])])), /500 rows/)
  assert.throws(() => readQualityImport(workbook([['itemno', 'description'], ...Array.from({ length: 70 }, (_, index) => [String(index), 'a'.repeat(30000)])])), /size limit/)
})
test('missing metadata fills existing product and preserves populated fields, zero stock and tax', () => {
  const fx = harness([product({ brand: 'Existing brand', gstRate: 0, warrantyMonths: 0, characteristics: ['Existing detail'] })])
  const plans = fx.api.planQualityImport([row({ itemno: '000042', name: 'Verified appliance name', brand: 'Replacement', price: '999', stock: '10', 'gst rate': '18', 'warranty months': '24', 'char desc': 'New detail' })], fx.products())
  assert.equal(plans[0].set.name, 'Verified Appliance Name')
  assert.equal(plans[0].preview.changes.find(change => change.field === 'name').after, plans[0].set.name)
  for (const field of ['brand', 'price', 'stock', 'gstRate', 'warrantyMonths', 'characteristics']) assert.equal(Object.hasOwn(plans[0].set, field), false, field)
  assert.deepEqual(fx.counts(), { writes: 0, sessions: 0, transactions: 0, ended: 0 })
})
test('a product id permits filling an absent itemno without changing its slug, stock or visibility', () => {
  const original = product({ _id: new ObjectId(id), itemno: undefined, sku: undefined, slug: 'stable-url', active: false })
  const fx = harness([original]), plans = fx.api.planQualityImport([row({ 'product id': id, itemno: 'NEW-0001', name: 'Verified appliance name' })], fx.products())
  assert.equal(plans[0].preview.error, '')
  assert.equal(plans[0].set.itemno, 'NEW-0001'); assert.equal(plans[0].set.sku, 'NEW-0001')
  assert.equal(Object.hasOwn(plans[0].set, 'slug'), false); assert.equal(Object.hasOwn(plans[0].set, 'active'), false)
})
test('unknown, duplicate, ambiguous and mismatched identities block the entire preview', () => {
  const fx = harness()
  for (const [rows, products, message] of [
    [[row({ itemno: 'unknown', name: 'Verified name' })], fx.products(), /not found/],
    [[row({ itemno: '000042' }), row({ itemno: '000042' }, 3)], fx.products(), /Duplicate/],
    [[row({ itemno: '000042' })], [...fx.products(), product({ _id: 'second' })], /Ambiguous/],
    [[row({ 'product id': id, itemno: 'wrong' })], fx.products(), /different identities/],
    [[row({ itemno: '000042' }), row({ 'product id': id }, 3)], fx.products(), /more than once/],
  ]) {
    const plans = fx.api.planQualityImport(rows, products), preview = fx.api.qualityImportPreview(plans)
    assert.equal(preview.canApply, false); assert.match(plans.at(-1).preview.error, message)
  }
})
test('legacy raw identities and specification-backed facts are respected', () => {
  const original = product({ itemno: undefined, sku: 'OLD-SKU', raw: { 'Item No.': '000042' } })
  const spec = { sku: '000042', product_id: id, technical_details: { 'Model Number': 'ACTUAL-MODEL', GST: '0', 'Manufacturer Warranty': '12 months' }, images: ['https://www.lg.com/real-product.jpg'] }
  const fx = harness([original]), plans = fx.api.planQualityImport([row({ itemno: '000042', name: 'Verified name', 'model number': 'different', 'gst rate': '18', 'warranty months': '24', images: 'https://www.lg.com/new-image.jpg' })], fx.products(), [spec])
  assert.equal(plans[0].preview.error, '')
  for (const field of ['modelNumber', 'gstRate', 'warrantyMonths', 'images']) assert.equal(Object.hasOwn(plans[0].set, field), false)
})
test('invalid GTIN, HSN, price/MRP and stock are rejected rather than partially applied', () => {
  const fx = harness([product({ price: 0, mrp: 0, stock: undefined })])
  for (const values of [{ gtin: '000000123' }, { 'hsn code': '123' }, { price: '₹200', mrp: '100' }, { stock: '-1' }, { stock: '1.5' }, { price: 'Infinity' }]) {
    const plan = fx.api.planQualityImport([row({ itemno: '000042', name: 'Verified appliance', ...values })], fx.products())[0]
    assert.ok(plan.preview.error); assert.equal(Object.keys(plan.set).length, 0)
  }
  const valid = fx.api.planQualityImport([row({ itemno: '000042', price: '₹1,000', mrp: '2,000', stock: '0', gtin: '4006381333931', 'hsn code': '8517' })], fx.products())[0]
  assert.equal(valid.preview.error, ''); assert.equal(valid.set.price, 1000); assert.equal(valid.set.stock, 0)
})
test('classification mapping retains existing semantic division and brand, leaving raw unchanged', () => {
  const original = product({ category: 'Electronics', groupName: 'Electronics', manufacturerName: 'Samsung', subCategory: 'Televisions', raw: { 'Category/Group Name': 'Electronics', 'sub-category/PROD DESC': 'Televisions', 'Manufacturer Name': 'Samsung' } })
  const fx = harness([original]), plan = fx.api.planQualityImport([row({ itemno: '000042', segment: 'Smart TV' })], fx.products())[0]
  assert.equal(plan.preview.error, ''); assert.equal(plan.set.division, 'Electronics'); assert.equal(plan.set.category, 'Televisions')
  assert.equal(plan.set.brand, 'Samsung'); assert.equal(plan.set.taxonomySource, 'metadata-sheet')
  assert.equal(Object.hasOwn(plan.set, 'raw'), false)
  assert.ok(plan.preview.changes.some(change => change.field.includes('classification mapping')))
})
test('preview never writes and approved saving uses one transaction with no product creation', async () => {
  const fx = harness(), rows = [row({ itemno: '000042', name: 'Verified appliance name', 'model number': 'ACTUAL-42' })]
  const preview = await fx.api.previewQualityImport(rows)
  assert.equal(preview.canApply, true); assert.equal(fx.counts().writes, 0)
  const saved = await fx.api.applyQualityImport(rows, preview.digest)
  assert.equal(saved.saved, 1); assert.equal(fx.products()[0].modelNumber, 'ACTUAL-42')
  assert.deepEqual(fx.counts(), { writes: 1, sessions: 1, transactions: 1, ended: 1 })
})
test('modified workbook or catalogue invalidates approval before any write', async () => {
  for (const changedFile of [true, false]) {
    const fx = harness(), rows = [row({ itemno: '000042', name: 'Verified appliance name' })]
    const preview = await fx.api.previewQualityImport(rows)
    if (!changedFile) fx.replace([product({ name: 'Concurrent correction' })])
    const changed = changedFile ? [row({ itemno: '000042', name: 'Different appliance' })] : rows
    await assert.rejects(() => fx.api.applyQualityImport(changed, preview.digest), /changed/)
    assert.equal(fx.counts().writes, 0); assert.equal(fx.counts().ended, 1)
  }
})
test('a failed transaction rolls back all field changes and closes its session', async () => {
  const fx = harness([product(), product({ _id: 'second', itemno: '000043', sku: '000043' })], { failWrite: true, failAfter: 2 })
  const rows = [row({ itemno: '000042', name: 'Verified appliance name' }), row({ itemno: '000043', name: 'Another verified appliance' }, 3)]
  const preview = await fx.api.previewQualityImport(rows)
  await assert.rejects(() => fx.api.applyQualityImport(rows, preview.digest), /Synthetic transaction/)
  assert.ok(fx.products().every(value => value.name === '')); assert.equal(fx.counts().ended, 1)
})
test('actual product lookup matches case-insensitive literal legacy headers and numeric item numbers', async () => {
  for (const original of [
    product({ itemno: undefined, sku: undefined, raw: { 'Item No.': '000042' } }),
    product({ itemno: undefined, sku: undefined, 'Item No.': '000042' }),
    product({ itemno: undefined, sku: undefined, rawData: { 'Item No.': '000042' } }),
    product({ itemno: 42, sku: undefined }),
  ]) {
    const fx = harness([original]), itemno = original.itemno === 42 ? '42' : '000042'
    const preview = await fx.api.previewQualityImport([row({ itemno, name: 'Verified appliance name' })])
    assert.equal(preview.canApply, true)
  }
  const fx = harness([product({ itemno: 'Case-42' })])
  const preview = await fx.api.previewQualityImport([row({ itemno: 'case-42', name: 'Verified appliance name' })])
  assert.equal(preview.canApply, true)
})
test('import endpoint requires a full admin before processing uploaded data', async () => {
  const fx = harness([], { denied: true })
  const response = await fx.loader.load('app/api/admin/catalogue-quality/import/route.ts').POST({ formData() { throw new Error('Must not read upload') } })
  assert.equal(response.status, 403); assert.equal(fx.counts().writes, 0)
})
test('multipart endpoint previews the actual Excel parser and refuses unreviewed saves', async () => {
  const fx = harness(), route = fx.loader.load('app/api/admin/catalogue-quality/import/route.ts')
  const bytes = workbook([['itemno', 'name'], ['000042', 'Verified appliance name']])
  const request = mode => {
    const form = new FormData(); form.set('file', new File([bytes], 'missing-data.xlsx')); form.set('mode', mode)
    return new Request('https://fixture.invalid/api/admin/catalogue-quality/import', { method: 'POST', body: form })
  }
  const previewResponse = await route.POST(request('preview')), preview = await previewResponse.json()
  assert.equal(previewResponse.status, 200); assert.equal(preview.canApply, true); assert.equal(fx.counts().writes, 0)
  const applyResponse = await route.POST(request('apply'))
  assert.equal(applyResponse.status, 409); assert.equal(fx.counts().writes, 0)
})

test('upload UI requires preview and explicit approval, and clears approval after saving or replacing the file', async () => {
  const states = [], requests = []; let slot = 0, saved = 0
  const loader = sourceLoader({
    react: { ...React, useState(initial) { const index = slot++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value }] } },
    'react-hot-toast': { __esModule: true, default: { success() {} } },
    '@/lib/api-client': { apiFetch: async (url, options) => {
      requests.push({ url, mode: options.body.get('mode'), digest: options.body.get('digest') })
      return { ok: true, json: async () => options.body.get('mode') === 'preview' ? {
        rows: [{ row: 2, productId: id, itemno: '000042', name: 'Fixture name', changes: [{ field: 'name', before: '', after: 'Fixture name' }], preserved: [], error: '' }],
        summary: { products: 1, fields: 1, errors: 0 }, canApply: true, digest: 'a'.repeat(64),
      } : { saved: 1 } }
    } },
  }, { context: { File, FormData } })
  const Component = loader.load('app/admin/catalogue-quality/catalogue-missing-data-upload.tsx').default
  const render = () => { slot = 0; return Component({ products: [], onSaved() { saved++ } }) }
  const all = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(all) : [tree, ...all(tree.props?.children)]
  const text = tree => !tree ? '' : typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join('') : text(tree.props?.children)
  const button = name => all(render()).find(element => element.type === 'button' && text(element).includes(name))
  const input = kind => all(render()).find(element => element.type === 'input' && element.props.type === kind)
  const click = async name => { button(name).props.onClick(); await new Promise(resolve => setTimeout(resolve, 0)) }
  assert.equal(button('Save missing data'), undefined)
  input('file').props.onChange({ target: { files: [new File(['fixture'], 'sheet.xlsx')] } })
  await click('Preview upload')
  assert.equal(requests.length, 1); assert.equal(button('Save missing data').props.disabled, true)
  await click('Save missing data'); assert.equal(requests.length, 1)
  input('checkbox').props.onChange({ target: { checked: true } })
  assert.equal(button('Save missing data').props.disabled, false)
  input('file').props.onChange({ target: { files: [new File(['replacement'], 'sheet.xlsx')] } })
  assert.equal(button('Save missing data'), undefined)
  await click('Preview upload')
  input('checkbox').props.onChange({ target: { checked: true } })
  await click('Save missing data')
  assert.equal(requests.at(-1).mode, 'apply'); assert.equal(requests.at(-1).digest, 'a'.repeat(64))
  assert.equal(saved, 1); assert.equal(button('Save missing data'), undefined)
})

test('download without a scan contains every product beyond 500 rows and all current supported values', async () => {
  const products = Array.from({ length: 601 }, (_, n) => product({ _id: 'product-' + n, itemno: '00' + n, sku: '00' + n,
    name: 'Existing product ' + n, division: 'Electronics', category: 'Televisions', segment: 'LED', brand: 'Samsung',
    description: 'Existing detailed product description.', modelNumber: 'MODEL-' + n, gtin: '4006381333931',
    hsnCode: '8517', gstRate: 0, warrantyText: 'Verified one year warranty', warrantyMonths: 0,
    images: ['https://www.lg.com/real-product.jpg'], seoTitle: 'Existing SEO title', seoDescription: 'Existing SEO description' }))
  const fx = harness(products), exportApi = fx.loader.load('lib/catalogue-quality-export.ts')
  const exported = await exportApi.exportQualityWorkbook()
  assert.equal(exported.total, 601)
  const book = XLSX.read(exported.bytes, { type: 'buffer' }), values = XLSX.utils.sheet_to_json(book.Sheets['Missing data'], { defval: '' })
  assert.equal(values.length, 601); assert.equal(values[600].itemno, '00600'); assert.equal(values[600].name, 'Existing product 600')
  for (const field of ['division', 'category', 'segment', 'brand', 'description', 'model number', 'gtin', 'hsn code', 'warranty', 'images', 'seo title', 'seo description']) assert.ok(values[0][field], field)
  assert.equal(values[0].price, 100); assert.equal(values[0].mrp, 150); assert.equal(values[0].stock, 0)
  assert.equal(values[0]['gst rate'], '0'); assert.equal(values[0]['warranty months'], '0')
  assert.equal(book.Sheets['Missing data'].B2.t, 's')
  assert.equal(fx.counts().writes, 0); assert.equal(fx.counts().sessions, 0)
})
test('filtered download contains the exact selection and resolves existing specification facts', async () => {
  const fx = harness([product({ name: 'Selected product' }), product({ _id: 'other', itemno: 'other', name: 'Excluded product' })], {
    specs: [{ sku: '000042', product_id: id, technical_details: { 'Model Number': 'SPEC-MODEL', GST: '18%' }, warrantyText: 'Verified manufacturer warranty' }],
  })
  const api = fx.loader.load('lib/catalogue-quality-export.ts'), exported = await api.exportQualityWorkbook([id])
  const values = XLSX.utils.sheet_to_json(XLSX.read(exported.bytes, { type: 'buffer' }).Sheets['Missing data'])
  assert.equal(values.length, 1); assert.equal(values[0].name, 'Selected product'); assert.equal(values[0]['model number'], 'SPEC-MODEL')
  assert.equal(values[0]['gst rate'], '18%'); assert.equal(values[0].warranty, 'Verified manufacturer warranty')
  await assert.rejects(() => api.exportQualityWorkbook([]), /No products match/)
  await assert.rejects(() => api.exportQualityWorkbook(['deleted']), /no catalogue products/)
})
test('prefilled legacy values survive an export/edit/upload roundtrip while missing data is filled', async () => {
  const fx = harness([product({ name: 'TV', gtin: 'legacy-invalid-barcode', description: 'd'.repeat(6000) })])
  const exported = await fx.loader.load('lib/catalogue-quality-export.ts').exportQualityWorkbook([id])
  const book = XLSX.read(exported.bytes, { type: 'buffer' }), sheet = book.Sheets['Missing data']
  const columns = fx.loader.load('lib/catalogue-quality-sheet.ts').QUALITY_IMPORT_COLUMNS
  const modelCell = XLSX.utils.encode_cell({ r: 1, c: columns.indexOf('model number') })
  sheet[modelCell] = { t: 's', v: 'VERIFIED-MODEL' }
  const rows = fx.api.readQualityImport(Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' })))
  const preview = await fx.api.previewQualityImport(rows)
  assert.equal(preview.canApply, true); assert.equal(preview.rows[0].changes.length, 1)
  await fx.api.applyQualityImport(rows, preview.digest)
  assert.equal(fx.products()[0].modelNumber, 'VERIFIED-MODEL'); assert.equal(fx.products()[0].name, 'TV')
  assert.equal(fx.products()[0].gtin, 'legacy-invalid-barcode'); assert.equal(fx.products()[0].description.length, 6000)
})
test('export blanks represent missing data and never invent prices, stock or identifiers', async () => {
  const fx = harness([product({ name: 'Existing product name', price: 0, mrp: undefined, stock: undefined })])
  const exported = await fx.loader.load('lib/catalogue-quality-export.ts').exportQualityWorkbook()
  const row = XLSX.utils.sheet_to_json(XLSX.read(exported.bytes, { type: 'buffer' }).Sheets['Missing data'], { defval: '' })[0]
  for (const field of ['price', 'mrp', 'stock', 'gtin', 'mpn', 'warranty', 'warranty months']) assert.equal(row[field], '', field)
})
test('legacy rawData MRP is exported and preserved rather than treated as missing', async () => {
  const fx = harness([product({ mrp: undefined, rawData: { MRP: '₹2,500' } })])
  const exported = await fx.loader.load('lib/catalogue-quality-export.ts').exportQualityWorkbook()
  const values = XLSX.utils.sheet_to_json(XLSX.read(exported.bytes, { type: 'buffer' }).Sheets['Missing data'])[0]
  assert.equal(values.mrp, 2500)
  const plan = fx.api.planQualityImport([row({ itemno: '000042', mrp: '3000', 'model number': 'VERIFIED-MODEL' })], fx.products())[0]
  assert.equal(Object.hasOwn(plan.set, 'mrp'), false); assert.equal(plan.set.modelNumber, 'VERIFIED-MODEL')
})
test('export endpoint requires full admin access and returns an authenticated Excel attachment', async () => {
  const denied = harness([], { denied: true })
  const failure = await denied.loader.load('app/api/admin/catalogue-quality/export/route.ts').POST({ json() { throw new Error('Must not read body') } })
  assert.equal(failure.status, 403)
  const fx = harness([product({ name: 'Existing product name' })]), route = fx.loader.load('app/api/admin/catalogue-quality/export/route.ts')
  const response = await route.POST(new Request('https://fixture.invalid/export', { method: 'POST', body: '{}' }))
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /spreadsheet/)
  assert.match(response.headers.get('content-disposition'), /attachment/); assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await response.arrayBuffer()), { type: 'buffer' }).Sheets['Missing data'])[0].name, 'Existing product name')
})

test('download button loads catalogue data before a scan and forwards the selection after a scan', async () => {
  const requests = []; let clicked = 0
  class FixtureURL extends URL { static createObjectURL() { return 'blob:fixture' } static revokeObjectURL() {} }
  const loader = sourceLoader({
    react: { ...React, useState(initial) { return [initial, () => {}] } },
    '@/lib/api-client': { apiFetch: async (url, options) => {
      requests.push({ url, selection: JSON.parse(options.body) })
      return { ok: true, blob: async () => new Blob(['fixture-workbook']) }
    } },
  }, { context: { URL: FixtureURL, document: {
    body: { appendChild() {} }, createElement() { return { click() { clicked++ }, remove() {} } },
  } } })
  const Component = loader.load('app/admin/catalogue-quality/catalogue-missing-data-upload.tsx').default
  const all = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(all) : [tree, ...all(tree.props?.children)]
  for (const products of [undefined, [{ id, issues: [] }]]) {
    const tree = Component({ products, onSaved() {} })
    all(tree).find(element => element.type === 'button').props.onClick()
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  assert.equal(clicked, 2); assert.equal(requests[0].url, '/api/admin/catalogue-quality/export')
  assert.deepEqual(requests[0].selection, {}); assert.deepEqual(requests[1].selection, { ids: [id] })
})
