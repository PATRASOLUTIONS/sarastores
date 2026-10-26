import assert from "node:assert/strict"
import test from "node:test"
import * as React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { sourceLoader } from "./source-loader.mjs"

// Isolated hook lifecycle, including React Strict Mode effect replay.
function hookFixture(fetch) {
  const states = [], refs = [], effects = []
  let stateIndex = 0, refIndex = 0, effectIndex = 0
  const loader = sourceLoader({ react: {
    ...React,
    useState: initial => {
      const index = stateIndex++
      if (!(index in states)) states[index] = initial
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value }]
    },
    useRef: initial => {
      const index = refIndex++
      if (!(index in refs)) refs[index] = { current: initial }
      return refs[index]
    },
    useMemo: callback => callback(),
    useEffect: (callback, deps) => {
      const index = effectIndex++
      const previous = effects[index]
      if (previous && deps.every((value, index) => Object.is(value, previous.deps[index]))) return
      previous?.cleanup?.()
      effects[index] = { callback, deps, cleanup: callback() }
    },
  } }, { fetch, context: {
    window: { addEventListener: () => { throw new Error("Unexpected focus refresh") } },
    document: { addEventListener: () => { throw new Error("Unexpected visibility refresh") } },
    setInterval: () => { throw new Error("Unexpected polling") },
  } })
  return {
    loader,
    render: (hook, ...args) => { stateIndex = 0; refIndex = 0; effectIndex = 0; return hook(...args) },
    replay: () => { for (const effect of effects) { effect.cleanup?.(); effect.cleanup = effect.callback() } },
  }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test("store list loads once through effect replay, address changes and rerenders; explicit retry reloads it", async () => {
  const calls = []
  const fx = hookFixture(async url => {
    calls.push(url)
    return Response.json({ success: true, stores: [
      { id: "blr", city: "Bangalore", name: "Bangalore store" },
      { id: "mys", city: "Mysore", name: "Mysore store" },
    ] })
  })
  const { useNearbyStores } = fx.loader.load("hooks/useNearbyStores.ts")
  fx.render(useNearbyStores, "", "Bangalore", { allStores: true })
  fx.replay()
  await settle()
  const first = fx.render(useNearbyStores, "", "Bangalore", { allStores: true })
  assert.equal(first.loading, false); assert.equal(first.stores[0].id, "blr")
  const ranked = fx.render(useNearbyStores, "", "Mysore", { allStores: true })
  assert.equal(ranked.stores[0].id, "mys")
  assert.deepEqual(calls, ["/api/stores"])
  ranked.retry()
  fx.render(useNearbyStores, "", "Mysore", { allStores: true })
  await settle()
  assert.deepEqual(calls, ["/api/stores", "/api/stores"])
})

test("stock checks deduplicate replay and equal cart quantities, and recheck changed quantities or retry", async () => {
  const calls = []
  const fx = hookFixture(async url => {
    calls.push(url)
    return Response.json({ success: true, storeIds: ["blr"], byStore: { blr: [{ itemCode: "ITEM", required: 2, available: 5 }] },
      deliveryAvailable: true, farDistanceKm: 15 })
  })
  const { useStoreStock } = fx.loader.load("hooks/useStoreStock.ts")
  fx.render(useStoreStock, [{ id: "p1", quantity: 2 }])
  fx.replay()
  await settle()
  const ready = fx.render(useStoreStock, [{ id: "p1", quantity: 1 }, { id: "p1", quantity: 1 }])
  assert.equal(ready.loading, false); assert.equal(ready.storeIds.has("blr"), true)
  assert.equal(calls.length, 1)
  fx.render(useStoreStock, [{ id: "p1", quantity: 3 }])
  await settle()
  const changed = fx.render(useStoreStock, [{ id: "p1", quantity: 3 }])
  assert.equal(calls.length, 2)
  changed.retry()
  fx.render(useStoreStock, [{ id: "p1", quantity: 3 }])
  await settle()
  assert.equal(calls.length, 3)
})

test("failed store requests stay retryable without starting automatic requests", async () => {
  let calls = 0
  const fx = hookFixture(async () => {
    calls++
    return calls === 1 ? Response.json({ error: "Fixture failure" }, { status: 503 }) :
      Response.json({ success: true, stores: [] })
  })
  const { useNearbyStores } = fx.loader.load("hooks/useNearbyStores.ts")
  fx.render(useNearbyStores)
  await settle()
  const failed = fx.render(useNearbyStores)
  assert.ok(failed.error); assert.equal(calls, 1)
  failed.retry()
  fx.render(useNearbyStores)
  await settle()
  assert.equal(fx.render(useNearbyStores).error, ""); assert.equal(calls, 2)
})

test("pickup payment shows the already-selected store without fetching another store list", () => {
  const changes = []
  const picker = sourceLoader({
    react: { ...React, useEffect: callback => callback() },
    "@/hooks/useNearbyStores": { useNearbyStores: () => { throw new Error("Pickup payment must reuse its store") } },
  }).load("components/PayAtStore.tsx").PayAtStoreStorePicker
  const markup = renderToStaticMarkup(picker({ isPickup: true, pickupStore: { id: "blr", name: "Fixture store" },
    value: null, onChange: value => changes.push(value) }))
  assert.ok(markup.includes("Fixture store")); assert.equal(changes[0].id, "blr")
})

test("pickup lists every eligible store in its horizontal list without a second hook or show-all click", () => {
  const stores = Array.from({ length: 9 }, (_, index) => ({ id: `s${index}`, name: `Store ${index}`, city: "Bangalore", distance: null }))
  const selector = sourceLoader({
    react: { ...React, useEffect: () => {}, useMemo: callback => callback(), useState: initial => [initial, () => {}] },
    "@/hooks/useSettingsData": { useSettingsData: () => ({ data: {} }) },
    "@/hooks/useNearbyStores": { formatDistance: () => "", useNearbyStores: () => { throw new Error("Store list is supplied by checkout") } },
    "@/lib/analytics": { analytics: {} },
    "./FulfilmentSelector.module.css": { storeGrid: "storeGrid" },
  }).load("components/FulfilmentSelector.tsx").default
  const markup = renderToStaticMarkup(selector({ method: "pickup", onMethodChange() {}, selectedStore: null, onStoreChange() {},
    nearby: { stores, loading: false, error: "", retry() {}, pincode: "" },
    stock: { storeIds: new Set(stores.map(store => store.id)), byStore: {}, loading: false, error: "", farDistanceKm: 15 } }))
  assert.equal((markup.match(/aria-label="Collect from Store/g) || []).length, 9)
  assert.ok(markup.includes('class="storeGrid" aria-label="Available pickup stores" tabindex="0"'))
  assert.equal(markup.includes("View All Stores"), false)
})
