import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const base = process.argv[2] || "http://localhost:3010"
const output = process.argv[3]
if (!output) throw new Error("Usage: node scripts/audit-browser.mjs <isolated-base-url> <report-path>")
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Browser audit requires a local isolated server")
const target = await fetch("http://localhost:9225/json/new?about:blank", { method: "PUT" }).then((response) => response.json())
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }) })
let sequence = 0
const pending = new Map()
const events = []
const toolingErrors = []
function call(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 120000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const promise = pending.get(message.id)
    if (!promise) return
    clearTimeout(promise.timeout)
    pending.delete(message.id)
    if (message.error) promise.reject(new Error(message.error.message))
    else promise.resolve(message.result)
    return
  }
  events.push(message)
  if (message.method === "Fetch.requestPaused") {
    const { requestId, request } = message.params
    // Never submit a form or trigger a payment, message, queue or real-data mutation.
    void call(request.method === "GET" || request.method === "HEAD" ? "Fetch.continueRequest" : "Fetch.failRequest",
      request.method === "GET" || request.method === "HEAD" ? { requestId } : { requestId, errorReason: "BlockedByClient" }).catch((error) => {
        if (error.message === "Invalid InterceptionId.") return // Navigation cancelled the intercepted request.
        toolingErrors.push(error.message)
        console.error("Browser interception error:", error.message)
      })
  }
})
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const results = []
const routes = ["/", "/products", "/product/audit-fixture-television", "/brands/audit-fixture", "/login", "/register", "/cart", "/checkout", "/contact", "/store-locator", "/privacy-policy", "/not-a-real-audit-page"]
try {
  await call("Page.enable")
  await call("Runtime.enable")
  await call("Network.enable")
  await call("Fetch.enable", { patterns: [{ urlPattern: "*" }] })
  await call("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__auditVitals = { lcp: null, cls: 0 };
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__auditVitals.lcp = e.startTime; })
      .observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__auditVitals.cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  ` })
  for (const [device, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: device === "mobile" })
    for (const route of routes) {
      events.length = 0
      const started = Date.now()
      await call("Page.navigate", { url: base + route })
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate("document.readyState === 'complete' && document.body.innerText.length > 30")) break
        await pause(150)
      }
      await pause(1500)
      await evaluate(fs.readFileSync(require.resolve("axe-core"), "utf8"))
      const accessibility = await evaluate(`axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }).then(r => ({
        violations: r.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, helpUrl: v.helpUrl,
          nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })),
        passes: r.passes.length, incomplete: r.incomplete.length
      }))`)
      const page = await evaluate(`({
        title: document.title, width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        vitals: window.__auditVitals, navigation: performance.getEntriesByType("navigation").map(n => ({
          ttfbMs: n.responseStart - n.requestStart, domContentLoadedMs: n.domContentLoadedEventEnd, loadMs: n.loadEventEnd })),
        images: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute("src")),
        headings: [...document.querySelectorAll("h1")].map(n => n.textContent.trim()),
        consentDialogNamed: [...document.querySelectorAll('[role="dialog"]')].every(n => {
          const id = n.getAttribute("aria-labelledby"); return !!n.getAttribute("aria-label") || !!(id && document.getElementById(id));
        })
      })`)
      const errors = events.filter((event) => event.method === "Runtime.exceptionThrown")
        .map((event) => event.params.exceptionDetails.text)
      const consoleErrors = events.filter((event) => event.method === "Runtime.consoleAPICalled" && event.params.type === "error")
        .map((event) => event.params.args.map((arg) => arg.value || arg.description).join(" ").slice(0, 300))
      const failedResponses = events.filter((event) => event.method === "Network.responseReceived" && event.params.response.status >= 400)
        .map((event) => ({ url: event.params.response.url.split("?")[0], status: event.params.response.status }))
      const extra = {}
      if (route === "/") {
        await call("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 })
        await call("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 })
        extra.firstKeyboardFocus = await evaluate("document.activeElement?.textContent?.trim()")
        extra.consentDetailNamed = await evaluate(`(() => {
          const b = [...document.querySelectorAll("button")].find(n => n.textContent.trim() === "Choose");
          b?.click(); return true;
        })()`)
        await pause(100)
        extra.consentDetailNamed = await evaluate(`(() => {
          const d = document.querySelector('[role="dialog"]'); const id = d?.getAttribute("aria-labelledby");
          return !!(id && document.getElementById(id)?.textContent.trim());
        })()`)
      }
      results.push({ device, route, measuredMs: Date.now() - started, page, accessibility, errors, consoleErrors, failedResponses, extra })
      fs.mkdirSync(path.dirname(output), { recursive: true })
      fs.writeFileSync(output, JSON.stringify({ base, browser: "Chromium CDP", safety: "All non-GET/HEAD browser requests blocked", toolingErrors, results }, null, 2))
      console.log(device, route, `axe=${accessibility.violations.length}`, `overflow=${page.scrollWidth > width}`, `LCP=${page.vitals?.lcp?.toFixed(0) || "unavailable"}ms`, `CLS=${page.vitals?.cls || 0}`)
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify({ base, browser: "Chromium CDP", safety: "All non-GET/HEAD browser requests blocked", toolingErrors, results }, null, 2))
  assert.equal(results.length, routes.length * 2)
  assert.equal(toolingErrors.length, 0)
  for (const result of results) {
    const label = `${result.device} ${result.route}`
    assert.equal(result.accessibility.violations.length, 0, `${label}: automated WCAG violations`)
    assert.equal(result.errors.length, 0, `${label}: uncaught JavaScript exceptions`)
    assert.equal(result.consoleErrors.length, 0, `${label}: runtime console errors`)
    assert.ok(result.page.scrollWidth <= result.page.width, `${label}: horizontal overflow`)
    assert.equal(result.page.images.length, 0, `${label}: broken images`)
    assert.equal(result.failedResponses.filter(({ url }) => new URL(url).pathname !== "/not-a-real-audit-page").length, 0, `${label}: failed HTTP requests`)
  }
} finally {
  await call("Page.close").catch(() => {})
  socket.close()
}
