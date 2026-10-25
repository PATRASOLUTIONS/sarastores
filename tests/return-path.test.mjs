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

test("browser URL normalization cannot bypass return-path checks", () => {
  for (const separator of ["\t", "\n", "\r"]) {
    const path = `/${separator}/evil.example/phish`
    assert.equal(new URL(path, "https://shop.example.invalid").origin, "https://evil.example")
    assert.equal(safeReturnPath(path), null)
    assert.equal(destinationAfterLogin({ role: "user" }, path), "/dashboard")
  }
  assert.equal(safeReturnPath("/shop/../login"), null)
  assert.equal(safeReturnPath("/shop/%2e%2e/register"), null)
  assert.equal(destinationAfterLogin({ role: "user" }, "/shop/../admin/orders"), "/dashboard")
  assert.equal(safeReturnPath("/shop/../cart?step=payment#details"), "/cart?step=payment#details")
})

function navigationHarness({ redirect = "", stored = "/checkout", authenticated = true } = {}) {
  const storage = new Map(stored ? [["redirectAfterLogin", stored]] : [])
  const tabStorage = new Map()
  const storageApi = map => ({
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, value),
    removeItem: key => map.delete(key),
  })
  const redirects = []
  let location = new URL("https://shop.example.invalid/product/fridge?color=white#specifications")
  let effects = []
  const window = { get location() { return location }, }
  const context = {
    window, document: { referrer: "https://shop.example.invalid/" },
    localStorage: storageApi(storage), sessionStorage: storageApi(tabStorage),
  }
  const jsx = (type, props) => ({ type, props })
  const loader = sourceLoader({
    react: { useEffect: effect => effects.push(effect), useState: value => [value, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": {
      usePathname: () => location.pathname,
      useSearchParams: () => location.searchParams,
    },
    "next/link": "link",
    "@/components/Header": "header", "@/components/Footer": "footer",
    "@/contexts/AuthContext": { useAuth: () => ({ user: { role: "user" }, isAuthenticated: authenticated }) },
    "@/hooks/useSubmitLock": { useSubmitLock: () => ({ acquire: () => true, release() {} }) },
    "@/hooks/useRecaptcha": { useRecaptcha: () => ({ enabled: false, isReady: true }) },
    "lucide-react": Object.fromEntries(["Eye", "EyeOff", "Mail", "Lock", "ArrowLeft", "Shield", "ShoppingCart", "Zap", "Headphones", "BadgeCheck"].map(name => [name, "icon"])),
    "isomorphic-dompurify": { sanitize: value => value },
  }, { context })
  const tracker = loader.load("components/LoginReturnTracker.tsx").default
  const login = loader.load("app/login/page.tsx").default
  const run = component => { effects = []; component(); for (const effect of effects) effect() }
  return {
    storage, tabStorage,
    visit(path) { location = new URL(path, location.origin); run(tracker) },
    login() {
      location = new URL(`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`, location.origin)
      location.assign = destination => redirects.push(destination)
      run(tracker)
      run(login)
      return redirects
    },
  }
}

test("plain login returns to the latest client-side page, including query and anchor", () => {
  const app = navigationHarness()
  app.visit("/")
  app.visit("/product/fridge?color=white#specifications")
  assert.deepEqual(app.login(), ["/product/fridge?color=white#specifications"])
  assert.equal(app.storage.has("redirectAfterLogin"), false)
})

test("explicit login redirect takes precedence over the previous page", () => {
  const app = navigationHarness({ redirect: "/checkout?step=payment" })
  app.visit("/offers")
  assert.deepEqual(app.login(), ["/checkout?step=payment"])
})

test("registration and password recovery preserve the page to resume after login", () => {
  const app = navigationHarness({ authenticated: false })
  app.visit("/cart")
  app.visit("/register")
  app.visit("/forgot-password")
  assert.deepEqual(app.login(), [])
  assert.equal(app.storage.get("redirectAfterLogin"), "/cart")
})

test("direct login keeps an explicit saved destination when no page was visited in this tab", () => {
  const app = navigationHarness()
  assert.deepEqual(app.login(), ["/checkout"])
})

test("login preserves password whitespace and markup characters", async () => {
  const states = [], calls = []
  let index = 0
  const jsx = (type, props) => ({ type, props })
  const page = sourceLoader({
    react: { useEffect() {}, useState: initial => {
      const slot = index++
      if (!(slot in states)) states[slot] = initial
      return [states[slot], value => { states[slot] = typeof value === "function" ? value(states[slot]) : value }]
    } },
    "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": "link",
    "next/navigation": { useSearchParams: () => new URLSearchParams() },
    "@/components/Header": "header", "@/components/Footer": "footer",
    "@/contexts/AuthContext": { useAuth: () => ({ isAuthenticated: false,
      login: async (...args) => { calls.push(args); return true } }) },
    "@/hooks/useSubmitLock": { useSubmitLock: () => ({ acquire: () => true, release() {} }) },
    "@/hooks/useRecaptcha": { useRecaptcha: () => ({ enabled: false, isReady: true }) },
    "lucide-react": Object.fromEntries(["Eye", "EyeOff", "Mail", "Lock", "ArrowLeft", "Shield", "ShoppingCart", "Zap", "Headphones", "BadgeCheck"].map(name => [name, "icon"])),
    "isomorphic-dompurify": { sanitize: value => value.replace(/<[^>]*>/g, "") },
  }).load("app/login/page.tsx").default
  const nodes = node => !node || typeof node !== "object" ? [] : Array.isArray(node)
    ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)]
  const render = () => { index = 0; return nodes(page()) }
  const password = "  <Secret> & Password!  "
  for (const [name, value] of [["email", "customer@example.com"], ["password", password]]) {
    render().find(node => node.type === "input" && node.props.name === name).props.onChange({ target: { name, value } })
  }
  assert.equal(render().find(node => node.type === "input" && node.props.name === "password").props.value, password)
  await render().find(node => node.type === "form").props.onSubmit({ preventDefault() {} })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1], password)
})
