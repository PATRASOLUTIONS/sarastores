import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

const { safeReturnPath, loginHref, destinationAfterLogin } = sourceLoader().load("lib/return-path.ts")

test("login return paths stay on this site", () => {
  assert.equal(safeReturnPath("/product/fridge?color=white"), "/product/fridge?color=white")
  assert.equal(safeReturnPath("/checkout"), "/checkout")
  assert.equal(safeReturnPath("https://evil.example/phish"), null)
  assert.equal(safeReturnPath("//evil.example"), null)
  assert.equal(safeReturnPath("/\\evil.example"), null)
  assert.equal(safeReturnPath("/login"), null)
  assert.equal(safeReturnPath("/register?next=/admin"), null)
  assert.equal(loginHref("/product/fridge", "?color=white"), "/login?redirect=%2Fproduct%2Ffridge%3Fcolor%3Dwhite")
  assert.equal(loginHref("/login", ""), "/login")
})

test("after login the shopper returns to the page they came from", () => {
  const customer = { role: "user" }
  const admin = { role: "admin" }
  const vendor = { role: "vendor" }
  assert.equal(destinationAfterLogin(customer, "/product/fridge"), "/product/fridge")
  assert.equal(destinationAfterLogin(admin, "/cart"), "/cart")
  assert.equal(destinationAfterLogin(vendor, "/offers"), "/offers")
  assert.equal(destinationAfterLogin(customer, "/admin/orders"), "/dashboard")
  assert.equal(destinationAfterLogin(admin, "/admin/orders"), "/admin/orders")
  assert.equal(destinationAfterLogin(customer, null), "/dashboard")
  assert.equal(destinationAfterLogin(admin, null), "/admin/dashboard")
  assert.equal(destinationAfterLogin(vendor, null), "/vendor/dashboard")
  assert.equal(destinationAfterLogin({ role: "user", dashboardAccess: true }, "/account/orders"), "/account/orders")
})
