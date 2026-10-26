import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"
import * as XLSX from "xlsx"

function tpinWorkbook(rows, bookType = "xlsx") {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Products")
  return XLSX.write(workbook, { type: "array", bookType })
}

test("bulk TPIN Excel import reads the named column, preserves zeros and removes duplicates", () => {
  const { importPromotionTpins } = sourceLoader().load("lib/promotion-tpin-import.ts")
  for (const bookType of ["xlsx", "xls"]) {
    const result = importPromotionTpins(tpinWorkbook([["Product", "TPIN Number"], ["Laptop", "00123"], ["Bag", "ITEM-2"], ["Duplicate", "item-2"], ["Blank", ""]], bookType))
    assert.deepEqual(Array.from(result.tpins), ["00123", "ITEM-2"])
    assert.equal(result.duplicates, 1)
  }
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([["TPIN"], [123]])
  sheet.A2.z = "000000"
  XLSX.utils.book_append_sheet(workbook, sheet, "Products")
  assert.equal(importPromotionTpins(XLSX.write(workbook, { type: "array", bookType: "xlsx" })).tpins[0], "000123")
})

test("bulk TPIN import rejects wrong columns, empty lists, malformed identifiers and oversized sheets", () => {
  const { importPromotionTpins } = sourceLoader().load("lib/promotion-tpin-import.ts")
  for (const rows of [[["Price"], [123]], [["TPIN"]], [["TPIN"], ["one,two"]], [["TPIN"], ["x".repeat(201)]]]) {
    assert.throws(() => importPromotionTpins(tpinWorkbook(rows)))
  }
  assert.throws(() => importPromotionTpins(tpinWorkbook([["TPIN"], ...Array.from({ length: 5001 }, (_, i) => [String(i)])])), /at most/)
  assert.equal(importPromotionTpins(tpinWorkbook([["Item No."], ...Array.from({ length: 5000 }, (_, i) => [String(i)])])).tpins.length, 5000)
})

test("bulk imported TPINs and selected gift survive coupon creation and restrict gift eligibility", async () => {
  const skus = Array.from(sourceLoader().load("lib/promotion-tpin-import.ts").importPromotionTpins(tpinWorkbook([["TPIN"], ["LAP-001"], ["ITEM-2"]])).tpins)
  let stored
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "admin" } }) },
    "@/lib/db-service": { COLLECTIONS: { COUPONS: "coupons" }, normalizeId: doc => { const { _id, ...fields } = doc; return { ...fields, id: String(_id) } },
      getCollection: async name => name === "gift_items" ? { findOne: async query => query._id === gift._id ? gift : null } : {
        findOne: async () => null, insertOne: async doc => { stored = { ...doc, _id: promoId }; return { insertedId: promoId } },
      } },
  })
  const response = await loader.load("app/api/coupons/route.ts").POST(new Request("https://fixture.invalid/api/coupons", {
    method: "POST", body: JSON.stringify({ code: base.code, name: base.name, type: base.type, giftId: base.giftId, applyScope: "skus", skus,
      buyQty: 2, getQty: 1, startDate: "2020-01-01", endDate: "2099-01-01", active: true }),
  }))
  assert.equal(response.status, 200)
  assert.deepEqual(Array.from((await response.json()).coupon.skus), skus)
  assert.equal(stored.giftId, gift._id)
  const { giftQuantity } = fixture()
  assert.equal(giftQuantity(stored, lines, null), 1)
  assert.equal(giftQuantity(stored, [{ ...lines[0], sku: "EXCLUDED" }], null), 0)
})

const promoId = new ObjectId()
const gift = { _id: "FREE-BAG", sku: "FREE-BAG", name: "Laptop Bag", photo: "https://example.com/bag.jpg", price: 600, mrp: 999, active: true }
const base = { _id: promoId, type: "buy_get_product", code: "FREEBAG", name: "Free laptop bag", active: true, giftId: gift._id,
  applyScope: "all", startDate: new Date("2020-01-01"), endDate: new Date("2099-01-01"), buyQty: 2, getQty: 1,
  usageCount: 0, usageLimit: 0, perCustomerLimit: 0, usageByUser: [] }
const lines = [{ id: "p1", sku: "LAP-001", division: "Computers", quantity: 2, price: 1000, name: "Laptop", type: "hardware" }]
const cursor = rows => ({ sort() { return this }, limit() { return this }, toArray: async () => rows })

test("failed gift checks expose the error and retry even while the quote remains unresolved", () => {
  const CartGifts = sourceLoader().load("components/cart/CartGifts.tsx").default
  const quote = { loading: true, error: "Could not check free gifts", offers: [], retry() {} }
  const html = renderToStaticMarkup(CartGifts({ quote }))
  assert.match(html, /role="alert"/)
  assert.match(html, /Could not check free gifts/)
  assert.match(html, /Retry/)
  assert.doesNotMatch(html, /Checking free gifts/)
  assert.match(renderToStaticMarkup(CartGifts({ quote, disabled: true })), /disabled=""/)
  assert.match(renderToStaticMarkup(CartGifts({ quote: { ...quote, error: "" } })), /role="status"/)
})
function fixture(promotions = [{ ...structuredClone(base), _id: promoId }], gifts = [structuredClone(gift)]) {
  const redemptions = new Map()
  const collections = {
    coupons: {
      find: query => cursor(promotions.filter(promo => promo.type === query.type && promo.active === query.active)),
      findOne: async query => {
        const promo = promotions.find(promo => String(promo._id) === String(query._id) && (!query.active || promo.active))
        return promo ? { ...structuredClone(promo), _id: promo._id } : null
      },
      updateOne: async (query, update, options) => {
        const promo = promotions.find(promo => String(promo._id) === String(query._id))
        if (!promo || query.usageCount && promo.usageCount >= query.usageCount.$lt) return { modifiedCount: 0 }
        assert.ok(options.session)
        promo.usageCount += update.$inc.usageCount
        if (update.$push) promo.usageByUser.push(update.$push.usageByUser)
        if (options.arrayFilters) promo.usageByUser.find(user => user.userId === options.arrayFilters[0]["user.userId"]).count++
        return { modifiedCount: 1 }
      },
    },
    gift_items: { find: query => cursor(gifts.filter(gift => query._id.$in.includes(gift._id) && gift.active)) },
    gift_promotion_redemptions: { insertOne: async doc => {
      if (redemptions.has(doc._id)) throw Object.assign(new Error("Duplicate redemption"), { code: 11000 })
      redemptions.set(doc._id, doc)
    } },
  }
  const loader = sourceLoader({ "@/lib/db-service": { getCollection: async name => {
    assert.ok(collections[name], `Unexpected collection ${name}`); return collections[name]
  } } })
  return { ...loader.load("lib/gift-promotions.ts"), loader, promotions, redemptions }
}

test("gift listing requires name, image, SKU, cent-rounded price and valid MRP", () => {
  const { CreateGiftSchema } = sourceLoader().load("lib/gift-validation.ts")
  assert.equal(CreateGiftSchema.safeParse({ sku: gift.sku, name: gift.name, photo: gift.photo, price: 600, mrp: 999 }).success, true)
  for (const patch of [{ name: "" }, { sku: "../bad" }, { photo: "javascript:alert(1)" }, { photo: "data:image/svg+xml;base64,abcd" }, { price: -1 }, { price: 1.001 }, { mrp: 1 }]) {
    assert.equal(CreateGiftSchema.safeParse({ sku: gift.sku, name: gift.name, photo: gift.photo, price: 600, mrp: 999, ...patch }).success, false, JSON.stringify(patch))
  }
})

test("new promotion requires gift, dates, selected scope and valid Buy/Get quantities; legacy Buy/Get remains valid", () => {
  const schema = sourceLoader().load("lib/coupon-validation.ts").CreateCouponSchema
  const payload = { code: "FREEBAG", name: "Bag offer", type: "buy_get_product", giftId: "FREE-BAG", buyQty: 2, getQty: 1, startDate: "2020-01-01", endDate: "2099-01-01" }
  assert.equal(schema.safeParse(payload).success, true)
  for (const patch of [{ giftId: null }, { startDate: null }, { endDate: null }, { buyQty: 0 }, { getQty: 101 }, { applyScope: "skus", skus: [] }, { applyScope: "divisions", divisions: [] }, { applyScope: "brands", brands: ["Example"] }, { usageLimit: -1 }]) {
    assert.equal(schema.safeParse({ ...payload, ...patch }).success, false, JSON.stringify(patch))
  }
  assert.equal(schema.safeParse({ code: "OLD", name: "Old buy/get", type: "buy_get", buyQty: 1, getQty: 1 }).success, true)
})

test("all-products gifts combine eligible quantities, repeat each Buy X group and cap gift units", () => {
  const { giftQuantity } = fixture()
  assert.equal(giftQuantity(base, lines, null), 1)
  assert.equal(giftQuantity(base, [{ ...lines[0], quantity: 1 }], null), 0)
  assert.equal(giftQuantity(base, [{ ...lines[0], quantity: 1 }, { ...lines[0], id: "p2", quantity: 3 }], null), 2)
  assert.equal(giftQuantity({ ...base, buyQty: 1, getQty: 100 }, [{ ...lines[0], quantity: 1000 }], null), 100)
})

test("specific SKU and division scopes use trusted catalogue metadata and match case-insensitively", () => {
  const { giftQuantity } = fixture()
  assert.equal(giftQuantity({ ...base, applyScope: "skus", skus: ["lap-001"] }, lines, null), 1)
  assert.equal(giftQuantity({ ...base, applyScope: "skus", skus: ["OTHER"] }, lines, null), 0)
  assert.equal(giftQuantity({ ...base, applyScope: "divisions", divisions: [" computers "] }, lines, null), 1)
  assert.equal(giftQuantity({ ...base, applyScope: "divisions", divisions: ["Appliances"] }, lines, null), 0)
  assert.equal(giftQuantity({ ...base, applyScope: "products", productIds: ["p2"] }, lines, null), 0)
})

test("multiple SKU and item-number selections combine qualifying units without counting a product twice", () => {
  const { giftQuantity } = fixture()
  const promotion = { ...base, applyScope: "skus", skus: ["lap-001", "item-2", "alias-2"] }
  const items = [{ ...lines[0], quantity: 1 }, { ...lines[0], id: "p2", sku: "OTHER", itemNumbers: ["ITEM-2", "ALIAS-2"], quantity: 1 }, { ...lines[0], id: "p3", sku: "EXCLUDED", quantity: 8 }]
  assert.equal(giftQuantity(promotion, items, null), 1)
  assert.equal(giftQuantity({ ...promotion, buyQty: 1 }, items, null), 2)
})

test("catalogue pricing supplies item-number aliases from the database and ignores forged cart metadata", async () => {
  const product = { _id: "p1", sku: "LAP-001", itemno: "ITEM-1", itemNo: 123, raw: { "Item No.": "RAW-1" }, name: "Laptop", price: 1000, stock: 20, active: true }
  const loader = sourceLoader({ "@/lib/db-service": { COLLECTIONS: { PRODUCTS: "products" }, getCollection: async name => ({ find: () => cursor(name === "products" ? [product] : []) }) } })
  const result = await loader.load("lib/order-pricing.ts").priceCatalogueCart([{ id: "p1", quantity: 2, itemNumbers: ["FORGED"] }])
  assert.equal(result.ok, true)
  assert.deepEqual(Array.from(result.items[0].itemNumbers), ["ITEM-1", "123", "RAW-1"])
  assert.equal(fixture().giftQuantity({ ...base, applyScope: "skus", skus: ["FORGED"] }, result.items, null), 0)
})

test("gift cart settings default to automatic/removable, survive edits and reject manual non-removable mode", () => {
  const { CreateCouponSchema, CouponPatchSchema, StoredCouponFieldsSchema } = sourceLoader().load("lib/coupon-validation.ts")
  const parsed = CreateCouponSchema.parse({ code: base.code, name: base.name, type: base.type, giftId: base.giftId, buyQty: base.buyQty, getQty: base.getQty, startDate: base.startDate, endDate: base.endDate })
  assert.equal(parsed.giftAutoAdd, true); assert.equal(parsed.giftRemovable, true)
  const patch = CouponPatchSchema.parse({ name: "Renamed" })
  assert.equal(Object.hasOwn(patch, "giftAutoAdd"), false)
  const edited = StoredCouponFieldsSchema.parse({ ...parsed, startDate: parsed.startDate.toISOString(), endDate: parsed.endDate.toISOString(), giftAutoAdd: false, ...patch })
  assert.equal(edited.giftAutoAdd, false)
  assert.equal(StoredCouponFieldsSchema.safeParse({ ...edited, startDate: edited.startDate.toISOString(), endDate: edited.endDate.toISOString(), giftRemovable: false }).success, false)
})

test("manual gifts are available to choose but are awarded only after explicit opt-in", async () => {
  const fx = fixture([{ ...base, giftAutoAdd: false }])
  assert.equal((await fx.quoteGiftPromotions(lines, null)).length, 0)
  const available = await fx.quoteGiftPromotions(lines, null, [], undefined, [], true)
  assert.equal(available.length, 1); assert.equal(available[0].giftAutoAdd, false)
  assert.equal((await fx.quoteGiftPromotions(lines, null, [], undefined, [String(promoId)])).length, 1)
  assert.equal((await fx.quoteGiftPromotions(lines, null, [String(promoId)], undefined, [String(promoId)])).length, 0)
})

test("non-removable gifts ignore forged declines on the server but still require eligible products", async () => {
  const fx = fixture([{ ...base, giftRemovable: false }])
  const awards = await fx.quoteGiftPromotions(lines, null, [String(promoId)])
  assert.equal(awards.length, 1); assert.equal(awards[0].giftRemovable, false)
  assert.equal((await fx.quoteGiftPromotions([{ ...lines[0], quantity: 1 }], null, [String(promoId)])).length, 0)
})

test("checkout quotes carry manual opt-in and reject an omitted mandatory gift", async () => {
  const pricing = { ok: true, items: lines, total: 2000 }
  const quote = fx => sourceLoader({ "@/lib/order-pricing": { priceOrder: async () => structuredClone(pricing) }, "@/lib/gift-promotions": { quoteGiftPromotions: fx.quoteGiftPromotions } }).load("lib/checkout-payment.ts")
  const manual = quote(fixture([{ ...base, giftAutoAdd: false }]))
  assert.equal((await manual.quoteCheckout(lines, { userId: null })).pricing.gifts.length, 0)
  const payload = manual.CheckoutQuoteSchema.parse({ items: lines, selectedGiftPromotions: [String(promoId)] })
  assert.equal((await manual.quoteCheckout(lines, { ...payload, userId: null })).pricing.gifts.length, 1)
  const locked = quote(fixture([{ ...base, giftRemovable: false }]))
  assert.equal((await locked.quoteCheckout(lines, { userId: null, declinedGiftPromotions: [String(promoId)], expectedGifts: [] })).ok, false)
})

test("cart renders manual Add free gift and hides removal controls for mandatory gifts", () => {
  const CartGifts = sourceLoader().load("components/cart/CartGifts.tsx").default
  const offer = { ...gift, promotionId: String(promoId), quantity: 1, giftAutoAdd: false, giftRemovable: true }
  const quote = { loading: false, error: "", offers: [offer], declinedGiftPromotions: [], selectedGiftPromotions: [], restore() {}, remove() {} }
  assert.match(renderToStaticMarkup(CartGifts({ quote })), /Add free gift/)
  assert.match(renderToStaticMarkup(CartGifts({ quote: { ...quote, selectedGiftPromotions: [String(promoId)] } })), /Remove gift/)
  const locked = renderToStaticMarkup(CartGifts({ quote: { ...quote, offers: [{ ...offer, giftAutoAdd: true, giftRemovable: false }], declinedGiftPromotions: [String(promoId)] } }))
  assert.match(locked, /Cannot be removed/); assert.doesNotMatch(locked, /Remove gift|Add gift back/)
})

test("validity dates include the final Indian day, and reject future, expired or malformed promotions", () => {
  const { giftQuantity } = fixture()
  const dated = { ...base, startDate: "2026-10-26T00:00:00+05:30", endDate: "2026-10-26T23:59:59.999+05:30" }
  assert.equal(giftQuantity(dated, lines, null, new Date("2026-10-26T12:00:00+05:30")), 1)
  assert.equal(giftQuantity(dated, lines, null, new Date(dated.endDate)), 1)
  assert.equal(giftQuantity(dated, lines, null, new Date("2026-10-27T00:00:00+05:30")), 0)
  assert.equal(giftQuantity(dated, lines, null, new Date("2026-10-25T23:59:59+05:30")), 0)
  assert.equal(giftQuantity({ ...base, startDate: "broken" }, lines, null), 0)
  assert.equal(giftQuantity({ ...base, endDate: null }, lines, null), 0)
})

test("total and authenticated per-customer caps are enforced before awarding", () => {
  const { giftQuantity } = fixture()
  assert.equal(giftQuantity({ ...base, usageLimit: 1, usageCount: 1 }, lines, "owner"), 0)
  assert.equal(giftQuantity({ ...base, perCustomerLimit: 1 }, lines, null), 0)
  assert.equal(giftQuantity({ ...base, perCustomerLimit: 1 }, lines, "owner"), 1)
  assert.equal(giftQuantity({ ...base, perCustomerLimit: 1, usageByUser: [{ userId: "owner", count: 1 }] }, lines, "owner"), 0)
})

test("default gift selection is server-generated; removal, inactive gifts and expired offers award nothing", async () => {
  const fx = fixture()
  const awards = await fx.quoteGiftPromotions(lines, null)
  assert.equal(awards.length, 1); assert.equal(awards[0].giftId, "FREE-BAG"); assert.equal(awards[0].quantity, 1)
  assert.equal((await fx.quoteGiftPromotions(lines, null, [String(promoId)])).length, 0)
  assert.equal((await fixture([base], [{ ...gift, active: false }]).quoteGiftPromotions(lines, null)).length, 0)
  assert.equal((await fixture([{ ...base, active: false }]).quoteGiftPromotions(lines, null)).length, 0)
})

test("order transaction records one promotion use per order and one per-customer use, not one per gift unit", async () => {
  const fx = fixture()
  const awards = await fx.quoteGiftPromotions([{ ...lines[0], quantity: 6 }], "owner")
  assert.equal(awards[0].quantity, 3)
  await fx.consumeGiftPromotions(awards, "ORDER-1", "owner", {})
  assert.equal(fx.promotions[0].usageCount, 1)
  assert.equal(fx.promotions[0].usageByUser[0].count, 1)
  assert.equal(fx.redemptions.size, 1)
  assert.equal([...fx.redemptions.values()][0].quantity, 3)
})

test("two competing redemptions cannot both claim the last total use", async () => {
  const fx = fixture([{ ...base, usageLimit: 1 }])
  const awards = await fx.quoteGiftPromotions(lines, null)
  const results = await Promise.allSettled([fx.consumeGiftPromotions(awards, "ORDER-A", null, {}), fx.consumeGiftPromotions(awards, "ORDER-B", null, {})])
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1)
  assert.equal(fx.promotions[0].usageCount, 1); assert.equal(fx.redemptions.size, 1)
})

test("free gift fingerprint binds SKU and quantity without binding image or display value changes", () => {
  const helper = sourceLoader().load("lib/checkout-payment.ts")
  const priced = { items: [{ id: "p1", price: 1000, quantity: 2 }], total: 2000 }
  const award = { promotionId: String(promoId), giftId: "FREE-BAG", sku: "FREE-BAG", quantity: 1, photo: gift.photo, price: 600 }
  const original = helper.checkoutFingerprint({ ...priced, gifts: [award] }, {}, 2000)
  assert.equal(helper.checkoutFingerprint({ ...priced, gifts: [{ ...award, photo: "https://example.com/new.jpg", price: 700 }] }, {}, 2000), original)
  assert.notEqual(helper.checkoutFingerprint({ ...priced, gifts: [{ ...award, quantity: 2 }] }, {}, 2000), original)
  assert.notEqual(helper.checkoutFingerprint(priced, {}, 2000), original)
})

test("removal choices survive refresh, merge on sign-in and reset only after a completed order", () => {
  const data = new Map()
  const storage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
  const loader = sourceLoader({}, { context: { localStorage: storage, window: { dispatchEvent() {} }, Event: class {} } })
  const choices = loader.load("hooks/useCartGifts.ts")
  data.set("sara_cart_gift_choices:guest", JSON.stringify([String(promoId)]))
  assert.equal(choices.readCartGiftChoices("guest")[0], String(promoId))
  assert.equal(choices.readCartGiftChoices("owner", "guest")[0], String(promoId))
  assert.equal(choices.readCartGiftChoices("owner")[0], String(promoId))
  choices.clearCartGiftChoices("owner")
  assert.equal(choices.readCartGiftChoices("owner").length, 0)
  assert.equal(choices.readCartGiftChoices("another-owner").length, 0)
  data.set("sara_cart_gift_selections:guest", JSON.stringify([String(promoId)]))
  assert.equal(choices.readCartGiftSelections("owner", "guest")[0], String(promoId))
  assert.equal(choices.readCartGiftSelections("owner")[0], String(promoId))
  choices.clearCartGiftChoices("owner")
  assert.equal(choices.readCartGiftSelections("owner").length, 0)
})

test("gift catalogue API guards both listing and mutation before database access", async () => {
  const loader = sourceLoader({ "@/lib/auth": { requireAdmin: async () => ({ ok: false, response: Response.json({ error: "Forbidden" }, { status: 403 }) }) },
    "@/lib/db-service": { getCollection: () => { throw new Error("Must not access database") } } })
  const route = loader.load("app/api/admin/gifts/route.ts")
  assert.equal((await route.GET()).status, 403)
  assert.equal((await route.POST(new Request("https://example.com", { method: "POST" }))).status, 403)
})

test("gift SKU creation is atomic and never writes the normal products collection", async () => {
  const rows = new Map()
  const loader = sourceLoader({
    "@/lib/auth": { requireAdmin: async () => ({ ok: true, user: { id: "admin" } }) },
    "@/lib/db-service": { normalizeId: value => { const { _id, ...rest } = value; return { ...rest, id: String(_id) } }, getCollection: async name => {
      assert.equal(name, "gift_items")
      return { insertOne: async doc => { if (rows.has(doc._id)) throw Object.assign(new Error("Duplicate"), { code: 11000 }); rows.set(doc._id, doc) } }
    } },
  })
  const route = loader.load("app/api/admin/gifts/route.ts")
  const create = () => route.POST(new Request("https://example.com", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku: gift.sku, name: gift.name, photo: gift.photo, price: gift.price, mrp: gift.mrp }) }))
  const responses = await Promise.all([create(), create()])
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]); assert.equal(rows.size, 1)
})
