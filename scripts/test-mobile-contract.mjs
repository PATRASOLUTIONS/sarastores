/**
 * Contract test: do the endpoints the mobile app calls return the shapes its
 * screens destructure? A type-check cannot catch this — the types are asserted,
 * not validated — so a `{ orders: [...] }` wrapper where the app expects a bare
 * array crashes the screen at runtime.
 *
 * Usage: node scripts/test-mobile-contract.mjs [baseUrl]
 * Requires MOBILE_TEST_EMAIL / MOBILE_TEST_PASSWORD.
 */
const BASE = process.argv[2] || "http://localhost:3005"
const EMAIL = process.env.MOBILE_TEST_EMAIL
const PASSWORD = process.env.MOBILE_TEST_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error("Set MOBILE_TEST_EMAIL and MOBILE_TEST_PASSWORD")
  process.exit(1)
}

let pass = 0
let fail = 0
function check(label, ok, detail = "") {
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${label}${detail ? "   " + detail : ""}`)
  ok ? pass++ : fail++
}

async function call(path, { method = "GET", token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  try {
    return { status: res.status, json: JSON.parse(text) }
  } catch {
    return { status: res.status, json: null, text }
  }
}

const shape = (value) =>
  Array.isArray(value) ? `array[${value.length}]` : value === null ? "null" : typeof value === "object" ? `object{${Object.keys(value).slice(0, 6).join(",")}}` : typeof value

console.log(`mobile API contract check against ${BASE}\n`)

const login = await call("/api/v1/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } })
if (login.status !== 200) {
  console.error("login failed, aborting:", login.status, login.json)
  process.exit(1)
}
const token = login.json.accessToken

// src/api/auth.ts -> persist(pair)
check("login: tokenType/accessToken/expiresIn/refreshToken/user",
  login.json.tokenType === "Bearer" && typeof login.json.accessToken === "string" &&
  typeof login.json.expiresIn === "number" && typeof login.json.refreshToken === "string" &&
  typeof login.json.user?.id === "string",
  shape(login.json))

// src/api/auth.ts fetchSession -> res.user
const session = await call("/api/auth/session", { token })
check("session: { user }", session.json && "user" in session.json, shape(session.json))

// src/api/catalog.ts fetchProducts -> Product[]  (screens call .map directly)
const products = await call("/api/products?fields=card&limit=5&display=1", { token })
check("products: bare array (NOT wrapped)", Array.isArray(products.json), shape(products.json))
const p0 = Array.isArray(products.json) ? products.json[0] : null
check("product: id + name + price are the right types",
  typeof p0?.id === "string" && typeof p0?.name === "string" && typeof p0?.price === "number",
  `id=${typeof p0?.id} name=${typeof p0?.name} price=${typeof p0?.price}`)
check("product.display matches ProductDisplay",
  typeof p0?.display?.mrp === "number" && typeof p0?.display?.discountPercent === "number" &&
  typeof p0?.display?.inStock === "boolean" && Array.isArray(p0?.display?.benefits) &&
  typeof p0?.display?.emi?.available === "boolean",
  shape(p0?.display))
check("product.display.badge is object|null (ProductCard reads .tone)",
  p0?.display?.badge === null || typeof p0?.display?.badge?.tone === "string",
  JSON.stringify(p0?.display?.badge))

// src/api/catalog.ts fetchProduct -> Product
if (p0?.slug) {
  const detail = await call(`/api/products/${encodeURIComponent(p0.slug)}?display=1`, { token })
  check("product detail: single object with display", detail.json && !Array.isArray(detail.json) && !!detail.json.display, shape(detail.json))
  check("product detail: images is an array (PDP gallery maps it)",
    detail.json?.images === undefined || Array.isArray(detail.json.images), shape(detail.json?.images))
}

// src/api/catalog.ts fetchCategories -> Category[]
const categories = await call("/api/categories", { token })
check("categories: bare array", Array.isArray(categories.json), shape(categories.json))

// src/api/catalog.ts fetchCart -> Cart { items }
const cart = await call("/api/cart", { token })
check("cart: { items: [] }", Array.isArray(cart.json?.items), shape(cart.json))

// src/api/catalog.ts fetchWishlist -> { items: Product[] }
const wishlist = await call("/api/wishlist", { token })
check("wishlist: { items: [] }", Array.isArray(wishlist.json?.items), shape(wishlist.json))

// src/api/catalog.ts fetchOrders -> Order[]  (orders screen calls FlatList data={data})
const orders = await call("/api/orders", { token })
check("orders: bare array (NOT { orders })", Array.isArray(orders.json), shape(orders.json))
const o0 = Array.isArray(orders.json) ? orders.json[0] : null
if (o0) {
  check("order: orderId + status + total present",
    typeof o0.orderId === "string" && typeof o0.status === "string" && typeof o0.total === "number",
    `orderId=${typeof o0.orderId} status=${typeof o0.status} total=${typeof o0.total}`)
  check("order.createdAt parses as a date (orders screen formats it)",
    !Number.isNaN(new Date(o0.createdAt).getTime()), String(o0.createdAt))
  check("order.items is an array (orders screen reads .length)", Array.isArray(o0.items), shape(o0.items))
}

// src/api/catalog.ts fetchReviews -> array
if (p0?.id) {
  const reviews = await call(`/api/reviews?productId=${encodeURIComponent(p0.id)}`, { token })
  check("reviews: bare array", Array.isArray(reviews.json), shape(reviews.json))
}

// src/api/checkout.ts placeOrder step 1
const sellable = Array.isArray(products.json) ? products.json.find((p) => p?.display?.inStock) : null
if (sellable) {
  const quote = await call("/api/payment/create-order", {
    method: "POST", token,
    body: { items: [{ id: sellable.id, productId: sellable.id, quantity: 1 }], currency: "INR" },
  })
  check("create-order: { orderId, amount, currency, keyId }",
    typeof quote.json?.orderId === "string" && typeof quote.json?.amount === "number" &&
    typeof quote.json?.keyId === "string",
    shape(quote.json))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
