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
test("a delayed pre-logout session response cannot restore the logged-out account", async () => {
  const app = harness({ deferSession: true })
  app.render().logout()
  app.completeSession(user)
  await flush()
  assert.equal(app.render().isAuthenticated, false)
  assert.equal(app.storage.has("user"), false)
})
