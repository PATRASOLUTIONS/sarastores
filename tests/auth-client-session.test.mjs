import assert from "node:assert/strict"
import test from "node:test"
import { sourceLoader } from "./source-loader.mjs"

const user = { id: "synthetic-customer", name: "Synthetic Customer", email: "customer@example.invalid", role: "user" }
function harness({ stored = user, session = null, deferSession = false } = {}) {
  const storage = new Map(stored ? [["user", JSON.stringify(stored)], ["loginTime", String(Date.now())], ["lastActivityTime", String(Date.now())]] : [])
  storage.set("redirectAfterLogin", "/checkout")
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
  const listeners = new Map()
  const effects = []
  const states = []
  let index = 0, mounted = false, sessionCalls = 0, resolveSession
  const response = async url => {
    if (url === "/api/auth/session") {
      sessionCalls++
      if (deferSession) return new Promise(resolve => { resolveSession = resolve })
      return Response.json({ user: session })
    }
    if (url.startsWith("/api/users/")) return Response.json(session)
    if (url === "/api/auth/logout") return Response.json({ success: true })
    throw new Error(`Unexpected isolated auth request: ${url}`)
  }
  const window = { fetch: response, location: { pathname: "/login", href: "/login" },
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const document = { hidden: false, visibilityState: "visible",
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) }
  const react = {
    createContext: () => ({ Provider: "context" }),
    useContext: () => undefined,
    useState: initial => {
      const slot = index++
      if (!(slot in states)) states[slot] = initial
      return [states[slot], value => { states[slot] = typeof value === "function" ? value(states[slot]) : value }]
    },
    useRef: initial => {
      const slot = index++
      if (!(slot in states)) states[slot] = { current: initial }
      return states[slot]
    },
    useEffect: effect => { if (!mounted) effects.push(effect) },
  }
  const provider = sourceLoader({
    react,
    "react/jsx-runtime": { jsx: (_type, props) => props },
    "react-hot-toast": { toast: { error() {}, success() {} } },
    "next/navigation": { useRouter: () => ({ push() {} }) },
  }, { fetch: response, context: { window, document, localStorage } }).load("contexts/AuthContext.tsx")
  const render = () => { index = 0; return provider.AuthProvider({ children: null }).value }
  render(); mounted = true
  for (const effect of effects) effect()
  return {
    render, storage, listeners,
    sessionCalls: () => sessionCalls,
    setSession: value => { session = value },
    completeSession: value => resolveSession(Response.json({ user: value })),
  }
}
const flush = async () => { await new Promise(setImmediate); await new Promise(setImmediate) }

test("account landing waits for hydration before redirecting an anonymous shopper", () => {
  for (const state of [{ user: null, isLoading: true }, { user: null, isLoading: false }, { user, isLoading: false }]) {
    const redirects = []
    const jsx = (type, props) => ({ type, props })
    const account = sourceLoader({
      react: { useEffect: effect => effect() },
      "@/contexts/AuthContext": { useAuth: () => ({ ...state, logout() {} }) },
      "next/navigation": { useRouter: () => ({ push: url => redirects.push(url) }) },
      "next/link": () => null,
      "lucide-react": { User: "icon", Package: "icon", Heart: "icon", MapPin: "icon", Settings: "icon", LogOut: "icon" },
      "react/jsx-runtime": { jsx, jsxs: jsx },
    }).load("app/account/page.tsx")
    const rendered = account.default()
    assert.deepEqual(redirects, !state.user && !state.isLoading ? ["/login?redirect=/account"] : [])
    if (state.isLoading) assert.equal(rendered.props.role, "status")
  }
})

test("missing cookie clears stale auth hints without redirecting a shopper away from login or losing checkout intent", async () => {
  const app = harness()
  await flush()
  assert.equal(app.render().isAuthenticated, false)
  assert.equal(app.render().isLoading, false)
  assert.equal(app.storage.has("user"), false)
  assert.equal(app.storage.get("redirectAfterLogin"), "/checkout")
  assert.equal(app.sessionCalls(), 1, "Anonymous hydration must not poll for eight seconds")
})
test("a valid server session hydrates the account even when no local hint exists", async () => {
  const app = harness({ stored: null, session: user })
  await flush()
  assert.equal(app.render().isAuthenticated, true)
  assert.equal(app.render().user.email, user.email)
  assert.equal(JSON.parse(app.storage.get("user")).id, user.id)
})
test("focus and storage changes revalidate the cookie instead of trusting a cached or spoofed role", async () => {
  const app = harness({ session: user })
  await flush()
  app.setSession(null)
  app.listeners.get("focus")()
  await flush()
  assert.equal(app.render().isAuthenticated, false)
  app.storage.set("user", JSON.stringify({ ...user, role: "admin" }))
  app.listeners.get("storage")({ key: "user", newValue: app.storage.get("user") })
  await flush()
  assert.equal(app.render().isAuthenticated, false)
  assert.equal(app.render().isAdmin, false)
})
test("login keeps the new session when a follow-up request is unauthorized", async () => {
  const calls = []
  const toasts = []
  const sessionUser = { ...user }
  let sessionVisible = false
  const storage = new Map()
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  }
  const listeners = new Map()
  const states = []
  let index = 0
  let mounted = false
  const response = async (url, init) => {
    const href = typeof url === "string" ? url : url instanceof URL ? url.toString() : url?.url || ""
    calls.push(`${init?.method || "GET"} ${href}`)
    if (href === "/api/auth/login") {
      sessionVisible = true
      return Response.json({ user: sessionUser })
    }
    if (href === "/api/auth/session") return Response.json({ user: sessionVisible ? sessionUser : null })
    if (href === "/api/auth/logout") return Response.json({ success: true })
    if (href.startsWith("/api/")) return Response.json({ error: "Authentication required" }, { status: 401 })
    throw new Error(`Unexpected isolated auth request: ${href}`)
  }
  const window = {
    fetch: response,
    location: { pathname: "/login", href: "/login", assign() {} },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  }
  const document = {
    hidden: false, visibilityState: "visible",
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  }
  const react = {
    createContext: () => ({ Provider: "context" }),
    useContext: () => undefined,
    useState: initial => {
      const slot = index++
      if (!(slot in states)) states[slot] = initial
      return [states[slot], value => { states[slot] = typeof value === "function" ? value(states[slot]) : value }]
    },
    useRef: initial => {
      const slot = index++
      if (!(slot in states)) states[slot] = { current: initial }
      return states[slot]
    },
    useEffect: effect => { if (!mounted) effects.push(effect) },
  }
  const effects = []
  const provider = sourceLoader({
    react,
    "react/jsx-runtime": { jsx: (_type, props) => props },
    "react-hot-toast": { toast: { error: message => toasts.push(message), success() {} } },
    "next/navigation": { useRouter: () => ({ push() {} }) },
  }, { fetch: response, context: { window, document, localStorage } }).load("contexts/AuthContext.tsx")
  const render = () => { index = 0; return provider.AuthProvider({ children: null }).value }
  render()
  mounted = true
  for (const effect of effects) effect()
  const result = await render().login("customer@example.invalid", "FixturePassword123!")
  assert.equal(result, true)
  assert.equal(render().isAuthenticated, true)
  assert.equal(render().user.id, sessionUser.id)
  assert.equal(calls.some(call => call.includes("/api/users/")), false)
  assert.equal(calls.some(call => call.startsWith("POST /api/auth/logout")), false)
  await window.fetch("/api/wishlist?userId=synthetic-customer")
  await flush()
  assert.equal(render().isAuthenticated, true)
  assert.equal(toasts.some(message => String(message).toLowerCase().includes("session has expired")), false)
  assert.equal(calls.some(call => call.startsWith("POST /api/auth/logout")), false)
})

test("password reset mail is branded Sara Stores and links to the live site", () => {
  const email = sourceLoader().load("lib/email.ts")
  assert.equal(email.storefrontOrigin(), "https://sarastores.com")
  const html = email.buildPasswordResetEmail("https://sarastores.com/reset-password?token=fixture")
  assert.match(html, /Sara Stores/)
  assert.match(html, /https:\/\/sarastores\.com\/reset-password\?token=fixture/)
  assert.equal(/bytewise/i.test(html), false)
  assert.match(email.saraMailFrom(), /^Sara Stores </)
})

test("a delayed pre-logout session response cannot restore the logged-out account", async () => {
  const app = harness({ deferSession: true })
  app.render().logout()
  app.completeSession(user)
  await flush()
  assert.equal(app.render().isAuthenticated, false)
  assert.equal(app.storage.has("user"), false)
})

function registrationHarness() {
  const states = []
  const signups = []
  let index = 0
  const jsx = (type, props) => ({ type, props })
  const page = sourceLoader({
    react: {
      Suspense: "suspense",
      useState: initial => {
        const slot = index++
        if (!(slot in states)) states[slot] = initial
        return [states[slot], value => { states[slot] = typeof value === "function" ? value(states[slot]) : value }]
      },
      useEffect() {},
      useMemo: callback => callback(),
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams() },
    "next/link": "link",
    "@/components/Header": "header",
    "@/components/Footer": "footer",
    "@/contexts/AuthContext": { useAuth: () => ({
      isAuthenticated: false,
      signup: async (...args) => { signups.push(args); return true },
    }) },
    "@/hooks/useSubmitLock": { useSubmitLock: () => ({ acquire: () => true, release() {} }) },
    "@/hooks/useRateLimit": { useRateLimit: () => ({
      attempts: 0, isLocked: false, canAttempt: true, recordAttempt() {}, resetAttempts() {},
    }) },
    "@/hooks/useRecaptcha": { useRecaptcha: () => ({ enabled: false, isReady: true }) },
    "@/lib/dpdp-config": { PRIVACY_NOTICE_VERSION: "fixture-notice" },
    "isomorphic-dompurify": { sanitize: value => value },
  }).load("app/register/page.tsx")
  function nodes(node) {
    if (!node || typeof node !== "object") return []
    if (Array.isArray(node)) return node.flatMap(nodes)
    return [node, ...nodes(node.props?.children)]
  }
  const render = () => {
    index = 0
    return nodes(page.default().props.children.type())
  }
  return {
    render, signups,
    change(name, value) {
      const input = render().find(node => node.type === "input" && node.props.name === name)
      assert.ok(input, `Missing registration input: ${name}`)
      input.props.onChange({ target: { name, type: input.props.type, value: String(value), checked: value === true } })
    },
    checkboxes: () => render().filter(node => node.type === "input" && node.props.type === "checkbox"),
    submit: () => render().find(node => node.type === "form").props.onSubmit({ preventDefault() {} }),
  }
}

test("registration agreements start unchecked and the combined agreement selects and clears all five", () => {
  const form = registrationHarness()
  assert.equal(form.checkboxes().length, 5)
  assert.ok(form.checkboxes().every(node => node.props.checked === false))
  form.change("agreeToTerms", true)
  assert.ok(form.checkboxes().every(node => node.props.checked === true))
  form.change("agreeToTerms", false)
  assert.ok(form.checkboxes().every(node => node.props.checked === false))
})

test("registration combined agreement clears both agreement errors without clearing unrelated errors", async () => {
  const form = registrationHarness()
  await form.submit()
  const messages = () => form.render().filter(node => node.type === "p").map(node => node.props.children)
  assert.ok(messages().includes("You must agree to the terms"))
  assert.ok(messages().includes("Please confirm you have read the privacy notice"))
  form.change("agreeToTerms", true)
  assert.ok(!messages().includes("You must agree to the terms"))
  assert.ok(!messages().includes("Please confirm you have read the privacy notice"))
  assert.ok(messages().includes("Name is required"))
})

for (const optOut of [false, true]) {
  test(`registration submits selected consent values with individual marketing opt-outs=${optOut}`, async () => {
    const form = registrationHarness()
    form.change("name", "Synthetic Customer")
    form.change("email", "customer@example.invalid")
    form.change("password", "FixturePassword123!")
    form.change("confirmPassword", "FixturePassword123!")
    form.change("agreeToTerms", true)
    if (optOut) {
      for (const name of ["marketingEmail", "marketingWhatsapp", "marketingSms"]) {
        form.change(name, false)
        assert.equal(form.checkboxes().find(node => node.props.name === name).props.checked, false)
        assert.equal(form.checkboxes().find(node => node.props.name === "agreeToTerms").props.checked, true)
        assert.equal(form.checkboxes().find(node => node.props.name === "agreePrivacyNotice").props.checked, true)
      }
    }
    await form.submit()
    assert.equal(form.signups.length, 1)
    assert.equal(form.signups[0][7], true)
    assert.deepEqual({ ...form.signups[0][8] }, {
      acceptPrivacyNotice: true, marketingEmail: !optOut, marketingWhatsapp: !optOut, marketingSms: !optOut,
      noticeVersion: "fixture-notice",
    })
  })
}
