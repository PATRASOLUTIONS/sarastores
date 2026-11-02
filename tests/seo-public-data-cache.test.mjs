import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

const { cachePublicData } = sourceLoader().load("lib/public-data-cache.ts")

test("public cache coalesces reads, expires after success and isolates consumers", async () => {
  let now = 0, reads = 0
  const get = cachePublicData(async () => { reads++; return [{ name: "Product", raw: { Brand: "Brand" }, detail: "x".repeat(3_000_000) }] }, 60, () => now)
  const [a, b] = await Promise.all([get(), get()])
  assert.equal(reads, 1)
  assert.equal(b[0].detail.length, 3_000_000)
  a[0].raw.Brand = "Changed"
  assert.equal((await get())[0].raw.Brand, "Brand")
  now = 59
  await get()
  assert.equal(reads, 1)
  now = 60
  await get()
  assert.equal(reads, 2)
})

test("failed public reads are retried and never cached as an empty catalogue", async () => {
  let reads = 0
  const get = cachePublicData(async () => { if (++reads === 1) throw new Error("Source unavailable"); return ["Product"] }, 60)
  await assert.rejects(get(), /Source unavailable/)
  assert.equal((await get())[0], "Product")
  assert.equal(reads, 2)
})
