import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const base = "http://localhost:3012"
const mode = process.argv[2] || "inspect"
const output = process.argv[3]
assert.ok(output, "Supply a report filename")
const status = await fetch("http://127.0.0.1:1588/audit/status").then(r => r.json())
assert.match(status.database, /^ecom_sara_audit_/)
const target = await fetch("http://localhost:9225/json/new?about:blank", { method: "PUT" }).then(r => r.json())
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }) })
let sequence = 0
const pending = new Map()
const events = []
const toolingErrors = []
const substituted = new Set()
const results = []
const steps = []
const runId = crypto.randomBytes(5).toString("hex")
const email = `customer${runId}@example.invalid`
const password = crypto.randomBytes(15).toString("base64url") + "Aa9!"
const resetPassword = crypto.randomBytes(15).toString("base64url") + "Aa9!"
const viewports = [[360, 800], [390, 844], [768, 1024], [1024, 768], [1440, 1000]]
const customerRoutes = ["/account", "/account/profile", "/account/preferences", "/account/privacy",
  "/account/orders", "/dashboard", "/dashboard/orders", "/dashboard/addresses", "/dashboard/cart",
  "/dashboard/wishlist", "/dashboard/membership", "/dashboard/offers", "/dashboard/support", "/dashboard/settings", "/dashboard/notifications"]
function call(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 90000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
const widget = `window.Razorpay = class {
  constructor(options) { this.options = options; }
  open() {
    const options = this.options;
    const dialog = document.createElement('div');
    dialog.id = 'audit-provider-dialog'; dialog.role = 'dialog'; dialog.setAttribute('aria-label', 'Synthetic payment provider');
    dialog.style.cssText = 'position:fixed;z-index:2147483647;inset:20%;background:white;padding:24px;border:4px solid #111;color:#111';
    dialog.innerHTML = '<h2>Synthetic payment provider: no real money</h2><button id="audit-pay-success">Simulate captured payment</button><button id="audit-pay-failure">Simulate invalid payment proof</button><button id="audit-pay-cancel">Cancel payment</button>';
    document.body.append(dialog);
    document.getElementById('audit-pay-cancel').onclick = () => { dialog.remove(); options.modal.ondismiss(); };
    for (const mode of ['success', 'failure']) document.getElementById('audit-pay-' + mode).onclick = () => {
      const id = Math.random().toString(36);
      const listener = async event => {
        if (event.detail.id !== id) return;
        window.removeEventListener('audit-payment-result', listener);
        dialog.remove();
        const proof = event.detail.proof;
        if (mode === 'failure') proof.razorpay_signature = '0'.repeat(64);
        await options.handler(proof);
      };
      window.addEventListener('audit-payment-result', listener);
      window.auditPayment(JSON.stringify({ id, orderId: options.order_id }));
    };
  }
};`
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const promise = pending.get(message.id)
    if (!promise) return
    clearTimeout(promise.timeout); pending.delete(message.id)
    if (message.error) promise.reject(new Error(message.error.message))
    else promise.resolve(message.result)
    return
  }
  events.push(message)
  if (message.method === "Fetch.requestPaused") {
    const { requestId, request } = message.params
    const url = new URL(request.url)
    let operation
    if (url.hostname === "www.google.com" && url.pathname === "/recaptcha/api.js") {
      substituted.add("Google reCAPTCHA browser widget and server validation")
      operation = call("Fetch.fulfillRequest", { requestId, responseCode: 200,
        responseHeaders: [{ name: "content-type", value: "application/javascript" }],
        body: Buffer.from("window.grecaptcha={ready:cb=>cb(),execute:async()=> 'audit-browser-token'};").toString("base64") })
    } else if (url.hostname === "checkout.razorpay.com" && url.pathname === "/v1/checkout.js") {
      substituted.add("Razorpay browser widget and local order/capture provider")
      operation = call("Fetch.fulfillRequest", { requestId, responseCode: 200,
        responseHeaders: [{ name: "content-type", value: "application/javascript" }], body: Buffer.from(widget).toString("base64") })
    } else if (["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "3012") {
      operation = call("Fetch.continueRequest", { requestId })
    } else if (["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) && request.method === "GET") {
      operation = call("Fetch.continueRequest", { requestId })
    } else if (request.method === "GET" && message.params.resourceType === "Image" &&
        (["images.unsplash.com", "m.media-amazon.com"].includes(url.hostname) || /^[abc]\.tile\.openstreetmap\.org$/.test(url.hostname))) {
      operation = call("Fetch.continueRequest", { requestId })
    } else {
      substituted.add(`Blocked external request: ${url.hostname}`)
      operation = call("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" })
    }
    void operation.catch(error => { if (!error.message.includes("InterceptionId")) toolingErrors.push(error.message) })
  }
  if (message.method === "Runtime.bindingCalled" && message.params.name === "auditPayment") {
    void (async () => {
      const request = JSON.parse(message.params.payload)
      const response = await fetch("http://127.0.0.1:1588/audit/payments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: request.orderId }) })
      assert.ok(response.ok)
      const proof = await response.json()
      await evaluate(`window.dispatchEvent(new CustomEvent('audit-payment-result', {detail:${JSON.stringify({ id: request.id, proof })}}))`)
    })().catch(error => toolingErrors.push(error.message))
  }
})
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function wait(expression, label, timeout = 20000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (await evaluate(expression)) return
    await pause(200)
  }
  throw new Error(`UI wait failed: ${label}`)
}
async function navigate(route) {
  events.length = 0
  const navigation = await call("Page.navigate", { url: route.startsWith("http") ? route : base + route })
  assert.ok(!navigation.errorText, navigation.errorText)
  if (navigation.loaderId) {
    const deadline = Date.now() + 30000
    while (!events.some(e => e.method === "Page.frameNavigated" && e.params.frame.loaderId === navigation.loaderId)) {
      assert.ok(Date.now() < deadline, `Navigation did not commit: ${route}`)
      await pause(100)
    }
  }
  await wait("document.readyState === 'complete' && document.body.innerText.length > 30", `loaded ${route}`)
  await pause(1800)
}
async function click(selector) {
  const point = await evaluate(`(() => {const element=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length); if(!element)throw Error('Missing visible selector');element.scrollIntoView({block:'center',behavior:'instant'}); const r=element.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`)
  await call("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 })
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 })
}
async function button(text) {
  const selector = await evaluate(`(() => {const e=[...document.querySelectorAll('button'),...document.querySelectorAll('a')].find(e=>e.getClientRects().length && e.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));if(!e)throw Error('Missing control: '+${JSON.stringify(text)});e.dataset.auditTarget='click';return '[data-audit-target="click"]';})()`)
  await click(selector)
  await evaluate("document.querySelector('[data-audit-target=\"click\"]')?.removeAttribute('data-audit-target')")
}
async function fill(selector, value) {
  await evaluate(`(() => {const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length);if(!e)throw Error('Missing visible field');e.focus();e.select?.();})()`)
  await call("Input.insertText", { text: value })
}
async function select(selector, value) {
  await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
}
function save() {
  fs.mkdirSync(path.dirname(output), { recursive: true })
  fs.writeFileSync(output, JSON.stringify({ database: status.database, fixtureRunId: runId, browser: "Chrome CDP", base,
    safety: "Real local application APIs and isolated synthetic database; captcha/payment widgets, captured payments and mail delivery are local fixtures; no live money/messages",
    providerSubstitutions: [...substituted], toolingErrors, steps, results }, null, 2))
}
async function screenshot(label) {
  const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
  fs.writeFileSync(path.join(path.dirname(output), `${label}.png`), Buffer.from(screenshot.data, "base64"))
}
async function step(label, action) {
  try { await action(); steps.push({ label, passed: true }); console.log("PASS:", label); save() }
  catch (error) {
    steps.push({ label, passed: false, error: error.message,
      diagnostics: await evaluate(`({path:location.pathname,fields:[...document.querySelectorAll('input')].map(e=>({id:e.id,name:e.name,checked:e.checked,valid:e.validity.valid})),buttons:[...document.querySelectorAll('button[type=submit]')].map(e=>({text:e.textContent,disabled:e.disabled}))})`),
      apiResponses: events.filter(e => e.method === "Network.responseReceived" && e.params.response.url.includes("/api/")).map(e => ({ path: new URL(e.params.response.url).pathname, status: e.params.response.status })) })
    await screenshot("journey-failure").catch(() => {})
    save()
    console.error(await evaluate("document.body.innerText.slice(-5000)"))
    throw error
  }
}
async function getMailLink(fragment, recipient = email) {
  const messages = await fetch("http://127.0.0.1:1588/audit/messages").then(r => r.json())
  const message = messages.filter(m => m.recipients.includes(recipient)).reverse().find(m => m.raw.includes(fragment))
  assert.ok(message, `Synthetic ${fragment} mail captured`)
  const decoded = message.raw.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  const link = decoded.match(new RegExp(`http://localhost:3012/[^"\\s<>]*${fragment}[^"\\s<>]*`))?.[0]
  assert.ok(link, "Captured email contains expected local link")
  return link.replaceAll("&amp;", "&")
}
async function addProduct(slug = "audit-fixture-television") {
  await navigate(`/product/${slug}`)
  await button("Add to Cart")
  await pause(900)
}
async function delivery(addressEmail = email) {
  await fill("#firstName", "Synthetic")
  await fill("#lastName", "Customer")
  await fill("#email", addressEmail)
  await fill("#phone", "9000000001")
  await fill("#address", "123 Synthetic Audit Street")
  await select("#city", "Bangalore")
  await fill("#pincode", "560001")
  await button(addressEmail === email ? "Save delivery address" : "Use this address")
}
async function measure(route, width, height, authenticated = false) {
  await navigate(route)
  const loadVitals = await evaluate("({...window.__auditVitals})")
  await evaluate(`(async () => {
    const bottom = document.documentElement.scrollHeight;
    for (let y=0;y<bottom;y+=innerHeight) {
      scrollTo({top:y,behavior:'instant'});
      await new Promise(resolve=>setTimeout(resolve,60));
    }
    await new Promise(resolve=>setTimeout(resolve,500));
    scrollTo({top:0,behavior:'instant'});
  })()`)
  await pause(400)
  await evaluate(fs.readFileSync(require.resolve("axe-core"), "utf8"))
  const accessibility = await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r=>({violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length,incomplete:r.incomplete.length}))`)
  const page = await evaluate(`({title:document.title,path:location.pathname,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    vitals:window.__auditVitals,images:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')),
    overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1)}).slice(0,12).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,100)}))})`)
  const errors = events.filter(e => e.method === "Runtime.exceptionThrown").map(e => e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)
  const consoleErrors = events.filter(e => e.method === "Runtime.consoleAPICalled" && e.params.type === "error").map(e => e.params.args.map(a => a.value || a.description).join(" ").slice(0,300))
  const failedResponses = events.filter(e => e.method === "Network.responseReceived" && e.params.response.status >= 400).map(e => ({ url: e.params.response.url.split("?")[0], status: e.params.response.status }))
  const result = { width, height, route, authenticated, fullPageScroll: true, loadVitals, page, accessibility, errors, consoleErrors, failedResponses }
  results.push(result); save()
  if (authenticated) assert.notEqual(page.path, "/login", `Authenticated route unexpectedly redirected: ${route}`)
  console.log(width, route, `axe=${accessibility.violations.length}`, `overflow=${page.scrollWidth > page.width}`, `errors=${errors.length}`, `images=${page.images.length}`)
  if (width === 390 || width === 1440 || accessibility.violations.length || page.scrollWidth > page.width) {
    await screenshot(`customer-${width}-${route.replaceAll(/[^a-z0-9]/gi, "_")}`)
  }
}
async function scanState(label, expectedFailure = false) {
  await evaluate(fs.readFileSync(require.resolve("axe-core"), "utf8"))
  const accessibility = await evaluate(`axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}}).then(r=>({violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length,incomplete:r.incomplete.length}))`)
  const page = await evaluate(`({title:document.title,path:location.pathname,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,vitals:window.__auditVitals,images:[...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src'))})`)
  results.push({ width: page.width, route: `${page.path} (${label})`, state: label, expectedFailure, page, accessibility,
    errors: events.filter(e=>e.method==="Runtime.exceptionThrown").map(e=>e.params.exceptionDetails.text) })
  save()
  console.log("STATE:", label, `axe=${accessibility.violations.length}`)
}
await call("Page.enable")
await call("Runtime.enable")
await call("Network.enable")
await call("Runtime.addBinding", { name: "auditPayment" })
await call("Fetch.enable", { patterns: [{ urlPattern: "*" }] })
await call("Page.addScriptToEvaluateOnNewDocument", { source: `
  window.__auditVitals={lcp:null,cls:0,shifts:[]};
  new PerformanceObserver(l=>{for(const e of l.getEntries())window.__auditVitals.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput){
    window.__auditVitals.cls+=e.value;
    if(window.__auditVitals.shifts.length<20)window.__auditVitals.shifts.push({value:e.value,
      sources:e.sources.map(s=>({tag:s.node?.tagName,className:s.node?.className,
        before:{x:s.previousRect.x,y:s.previousRect.y,width:s.previousRect.width,height:s.previousRect.height},
        after:{x:s.currentRect.x,y:s.currentRect.y,width:s.currentRect.width,height:s.currentRect.height}}))});
  }}).observe({type:'layout-shift',buffered:true});
` })
try {
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  if (mode === "inspect") {
    await navigate(process.argv[4] || "/")
    console.log(await evaluate("JSON.stringify({text:document.body.innerText,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent.trim(),label:e.getAttribute('aria-label')})),fields:[...document.querySelectorAll('input,select,textarea')].map(e=>({id:e.id,name:e.name,type:e.type,options:e.tagName==='SELECT'?[...e.options].map(o=>o.value):undefined}))},null,2)"))
    await screenshot("customer-inspect")
  } else if (mode === "journey") {
    await call("Network.clearBrowserCookies")
    await step("Expired cookies do not let stored hints redirect login or registration", async () => {
      await navigate("/login")
      await evaluate("localStorage.setItem('user',JSON.stringify({id:'audit-stale-hint',role:'user'}))")
      await navigate("/login")
      await pause(8500)
      assert.equal(await evaluate("location.pathname"), "/login")
      assert.equal(await evaluate("localStorage.getItem('user')"), null)
      await evaluate("localStorage.setItem('user',JSON.stringify({id:'audit-stale-hint',role:'user'}))")
      await navigate("/register")
      await pause(8500)
      assert.equal(await evaluate("location.pathname"), "/register")
      assert.equal(await evaluate("localStorage.getItem('user')"), null)
    })
    await step("Registration form rejects missing details", async () => {
      await navigate("/register")
      if (await evaluate("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Reject all')")) await button("Reject all")
      await button("Create Account")
      assert.ok(await evaluate("['Name is required','Email is required','Password is required','Please confirm your password','You must agree to the terms','Please confirm you have read the privacy notice'].every(text=>document.querySelector('#name').form.innerText.includes(text))"))
      assert.equal(events.filter(e => e.method === "Fetch.requestPaused" && new URL(e.params.request.url).pathname === "/api/auth/signup").length, 0)
      await scanState("missing-registration-details", true)
    })
    await step("Register synthetic account with required consent", async () => {
      await fill("#name", "Synthetic Customer")
      await fill("#email", email)
      await fill("#password", password)
      await fill("#confirmPassword", password)
      await click('[name="agreeToTerms"]')
      await click('[name="agreePrivacyNotice"]')
      await scanState("completed-registration-form")
      await pause(3200)
      await button("Create Account")
      await wait("location.pathname !== '/register'", "registration completion")
      await wait("document.body.innerText.includes('verify') || location.pathname === '/login'", "verification notice")
    })
    await step("Verify account through captured local email link", async () => {
      await navigate(await getMailLink("verify-email"))
      assert.ok(await evaluate("/verified|success/i.test(document.body.innerText)"))
    })
    await step("Login wrong password is rejected without a session", async () => {
      await navigate("/login")
      await fill("#email", email)
      await fill("#password", resetPassword)
      await button("Sign In")
      await wait("/invalid|incorrect/i.test(document.body.innerText)", "invalid credentials feedback")
      assert.equal(await evaluate("fetch('/api/auth/session').then(r=>r.json()).then(d=>!!d.user)"), false)
      await scanState("invalid-login", true)
    })
    await step("Login valid account and open authenticated profile", async () => {
      await fill("#password", password)
      await pause(3200)
      await button("Sign In")
      await wait("location.pathname !== '/login'", "successful login")
      await navigate("/account/profile")
      assert.ok(await evaluate("document.body.innerText.includes('Profile')"))
    })
    await step("Profile edits persist after reloading the account page", async () => {
      await fill('input[name="name"]', "Synthetic Customer Updated")
      await fill('input[name="phone"]', "9000000001")
      await button("Save Profile")
      await pause(1500)
      await navigate("/account/profile")
      assert.equal(await evaluate("document.querySelector('input[name=name]').value"), "Synthetic Customer Updated")
      assert.equal(await evaluate("document.querySelector('input[name=phone]').value"), "9000000001")
    })
    await step("Mobile search finds a catalogue product", async () => {
      await navigate("/")
      await fill('input[placeholder*="Search for products"]', "Audit")
      await click('[aria-label="Search"]')
      await wait("location.pathname === '/products' && new URLSearchParams(location.search).get('search') === 'Audit'", "search results")
      await wait("document.body.innerText.includes('Audit Fixture Television')", "matching product")
    })
    await step("Wishlist addition and removal persist across page loads", async () => {
      await navigate("/product/audit-fixture-television")
      await click('[aria-label="Add to wishlist"]')
      await pause(900)
      await navigate("/wishlist")
      assert.ok(await evaluate("document.body.innerText.includes('Audit Fixture Television')"))
      await navigate("/product/audit-fixture-television")
      await click('[aria-label="Remove from wishlist"]')
      await pause(900)
      await navigate("/wishlist")
      assert.ok(await evaluate("/empty|no items|no products/i.test(document.body.innerText)"))
    })
    await step("Two products can be compared and the comparison cleared", async () => {
      await navigate("/products")
      await click('[aria-label$="to comparison"]')
      await pause(400)
      await click('[aria-label$="to comparison"]')
      await navigate("/compare")
      assert.ok(await evaluate("document.body.innerText.includes('Audit Fixture Television Two') && document.body.innerText.includes('Audit Fixture Television')"))
      await button("Clear")
      await wait("!document.body.innerText.includes('Audit Fixture Television Two')", "comparison cleared")
    })
    await step("Product can be added to cart through mobile UI", async () => {
      await addProduct()
      await navigate("/cart")
      assert.ok(await evaluate("document.body.innerText.includes('Audit Fixture Television')"))
    })
    await step("Cart quantity increment and decrement update the displayed quantity", async () => {
      await click('[aria-label^="Increase quantity"]')
      await wait("document.querySelector('[aria-label^=\"Quantity for\"]').textContent.trim() === '2'", "quantity increment")
      await click('[aria-label^="Decrease quantity"]')
      await wait("document.querySelector('[aria-label^=\"Quantity for\"]').textContent.trim() === '1'", "quantity decrement")
      await screenshot("mobile-cart-populated")
      await scanState("populated-cart")
    })
    await step("Checkout validates address and prepares real priced payment", async () => {
      await navigate("/checkout")
      await button("Pay Now")
      await wait("document.body.innerText.includes('Please fill in address')", "missing checkout address")
      assert.equal(await evaluate("!!document.querySelector('#audit-provider-dialog')"), false)
      await delivery()
      await pause(800)
      assert.ok(await evaluate("!document.querySelector('#firstName').getClientRects().length"), "Saved delivery address selected")
      await screenshot("mobile-checkout-filled")
      await scanState("saved-address-checkout")
      await button("Pay Now")
      await wait("!!document.querySelector('#audit-provider-dialog')", "payment widget opened")
    })
    await step("Payment cancellation returns to checkout with cart intact", async () => {
      await click("#audit-pay-cancel")
      assert.ok(await evaluate("location.pathname === '/checkout' && document.body.innerText.includes('Audit Fixture Television')"))
    })
    await step("Invalid payment proof is rejected by real verification API", async () => {
      await button("Pay Now")
      await wait("!!document.querySelector('#audit-pay-failure')", "payment retry widget")
      await click("#audit-pay-failure")
      await wait("document.body.innerText.includes('Payment verification failed')", "payment rejection")
      await scanState("invalid-payment-proof", true)
    })
    await step("Synthetic captured payment creates order and confirmation", async () => {
      await button("Pay Now")
      await wait("!!document.querySelector('#audit-pay-success')", "payment success widget")
      await click("#audit-pay-success")
      await wait("document.body.innerText.includes('Order Summary (1 item)') && document.body.innerText.includes('View order details')", "order confirmation", 40000)
      await screenshot("mobile-order-confirmation")
      await scanState("paid-order-confirmation")
    })
    await step("Order appears in authenticated history; cart is cleared", async () => {
      await navigate("/account/orders")
      await wait("document.body.innerText.includes('Audit Fixture Television') || /SARAECOM-/.test(document.body.innerText)", "stored order history")
      assert.ok(await evaluate("document.body.innerText.includes('Audit Fixture Television') || /SARAECOM-/.test(document.body.innerText)"))
      await navigate("/cart")
      assert.ok(await evaluate("/cart is empty|empty cart/i.test(document.body.innerText)"))
    })
    await step("Logout invalidates session and account access", async () => {
      await navigate("/account/profile")
      await button("Account Menu")
      await button("Logout")
      await pause(1000)
      await navigate("/account/profile")
      assert.equal(await evaluate("location.pathname"), "/login")
    })
    await step("Forgot password sends local recovery mail", async () => {
      await navigate("/forgot-password")
      await fill("#email", email)
      await button("Send Reset")
      await wait("document.body.innerText.includes('Email sent successfully!')", "recovery notice")
    })
    await step("Reset password with captured link and log in again", async () => {
      await navigate(await getMailLink("reset-password"))
      await fill("#password", resetPassword)
      await fill("#confirmPassword", resetPassword)
      await button("Reset Password")
      await wait("document.body.innerText.includes('Password reset successful!') || location.pathname === '/login'", "password reset")
      await navigate("/login")
      await fill("#email", email)
      await fill("#password", resetPassword)
      await pause(3200)
      await button("Sign In")
      await wait("location.pathname !== '/login'", "login with new password")
    })
    await step("Authenticated account and dashboard pages render at five viewport sizes", async () => {
      for (const [width, height] of viewports) {
        await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 })
        for (const route of customerRoutes) {
          await measure(route, width, height, true)
        }
      }
    })
    await step("Desktop logout and guest checkout remain accessible", async () => {
      await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
      await navigate("/account/profile")
      await button("Logout")
      await pause(1000)
      await addProduct("audit-fixture-television-two")
      await navigate("/checkout")
      await button("Continue as guest")
      await delivery(`guest${runId}@example.invalid`)
      await click('input[value="cash-on-delivery"]')
      await screenshot("desktop-guest-checkout")
      await scanState("guest-checkout")
    })
    await step("Guest COD order confirmation provides a private order link", async () => {
      await button("Place Order")
      await wait("document.body.innerText.includes('Save your private order link')", "guest order confirmation", 40000)
      assert.ok(await evaluate("document.body.innerText.includes('Save your private order link')"))
      await screenshot("desktop-guest-confirmation")
      await scanState("guest-order-confirmation")
      await button("View order details")
      await wait("location.pathname.startsWith('/order/') || location.pathname === '/thank-you'", "private guest order page")
      await pause(1800)
      assert.ok(await evaluate("document.body.innerText.includes('Audit Fixture Television Two')"))
    })
    await step("Guest cart is cleared and order is inaccessible without its private token", async () => {
      const routeWithoutToken = await evaluate("location.pathname + (location.pathname === '/thank-you' ? '?orderId='+new URLSearchParams(location.search).get('orderId') : '')")
      await evaluate("localStorage.removeItem('guest_order_'+(location.pathname === '/thank-you' ? new URLSearchParams(location.search).get('orderId') : location.pathname.split('/').pop()))")
      await navigate(routeWithoutToken)
      await wait("/not found|could not|couldn't|unable|sign in|log in|unavailable/i.test(document.body.innerText)", "guest order access denied without cached capability")
      assert.ok(await evaluate("!document.body.innerText.includes('Audit Fixture Television Two')"))
      await navigate("/cart")
      assert.ok(await evaluate("/cart is empty|empty cart/i.test(document.body.innerText)"))
    })
  } else if (mode === "guest-proof") {
    const route = process.argv[4]
    assert.match(route || "", /^\/order\/SARAECOM-\d+$/)
    await call("Network.clearBrowserCookies")
    await step("Guest cached link works, but removing its capability denies access and the cart stays empty", async () => {
      await navigate(route)
      await wait("document.body.innerText.includes('Audit Fixture Television Two')", "guest order reload with cached capability")
      await evaluate(`localStorage.removeItem(${JSON.stringify(`guest_order_${route.split("/").pop()}`)})`)
      await navigate(route)
      await wait("/couldn't find|please sign in/i.test(document.body.innerText)", "guest order denial without capability")
      assert.ok(await evaluate("!document.body.innerText.includes('Audit Fixture Television Two')"))
      await scanState("guest-order-access-denied", true)
      await navigate("/cart")
      await wait("/cart is empty|empty cart/i.test(document.body.innerText)", "empty guest cart")
      await scanState("guest-cart-cleared")
    })
  } else if (["auth-screens", "auth-screens-resume", "account-screens"].includes(mode)) {
    if (mode !== "auth-screens-resume") {
      await call("Network.clearBrowserCookies")
      await step("Verify and log in a synthetic account for authenticated-layout rechecks", async () => {
        await navigate("/register")
        await fill("#name", "Synthetic Customer")
        await fill("#email", email)
        await fill("#password", password)
        await fill("#confirmPassword", password)
        await click('[name="agreeToTerms"]')
        await click('[name="agreePrivacyNotice"]')
        await pause(3200)
        await button("Create Account")
        await wait("location.pathname !== '/register'", "registration completion")
        await navigate(await getMailLink("verify-email"))
        await wait("/verified|success/i.test(document.body.innerText)", "verified account")
        await navigate("/login")
        await fill("#email", email)
        await fill("#password", password)
        await pause(3200)
        await button("Sign In")
        await wait("location.pathname !== '/login'", "verified login")
        if (mode === "auth-screens") {
          await addProduct()
          await navigate("/checkout")
          await delivery()
          await wait("!document.querySelector('#firstName')?.getClientRects().length", "saved address selection")
        }
      })
    } else {
      await navigate("/checkout")
      assert.ok(await evaluate("fetch('/api/auth/session').then(r=>r.json()).then(d=>d.user?.email?.endsWith('@example.invalid'))"), "Resume requires a verified synthetic session")
    }
    if (mode !== "account-screens") await step("Authenticated COD purchase prepares a populated account for layout rechecks", async () => {
      await wait("document.querySelector('input[value=\"cash-on-delivery\"]')?.disabled === false", "enabled COD payment control")
      await click('input[value="cash-on-delivery"]')
      await wait("[...document.querySelectorAll('button')].some(b=>b.textContent.trim().startsWith('Place Order'))", "COD order action")
      await button("Place Order")
      await wait("document.body.innerText.includes('Order Summary (1 item)') && document.body.innerText.includes('View order details')", "authenticated COD fixture confirmation", 40000)
    })
    for (const [width, height] of viewports) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 })
      for (const route of mode === "account-screens" ? ["/account"] : customerRoutes) {
        await measure(route, width, height, true)
        if (mode === "account-screens") assert.equal(results.at(-1).page.path, "/account", "Account landing must not bounce through login")
      }
    }
  } else if (mode === "states") {
    await call("Network.clearBrowserCookies")
    await navigate("/register")
    await button("Create account")
    await scanState("missing-registration-details", true)
    await fill("#password", password)
    await scanState("completed-registration-password")
    for (const [label, value] of [["weak", "a"], ["fair", "abcdefgh"], ["good", "abcdefgh1"]]) {
      await fill("#password", value)
      await scanState(`${label}-registration-password`)
    }
    await navigate("/reset-password?token=synthetic-state-token")
    await fill("#password", password)
    await scanState("completed-reset-password")
  } else if (mode === "forms") {
    await call("Network.clearBrowserCookies")
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await step("Contact enquiry is submitted through the desktop form with consent", async () => {
      await navigate("/contact")
      await fill('input[name="name"]', "Synthetic Customer")
      await fill('input[name="company"]', "Synthetic Audit")
      await fill('input[name="email"]', email)
      await fill('input[name="phone"]', "9000000001")
      await select('select[name="enquiryType"]', "Product Enquiry")
      await select('select[name="city"]', "Bengaluru")
      await fill('textarea[name="message"]', "Synthetic isolated audit enquiry. No real purchase or contact requested.")
      await click('input[name="consent"]')
      await button("Submit Enquiry")
      await wait("document.body.innerText.includes('Enquiry received')", "contact acknowledgement")
      await screenshot("desktop-contact-submitted")
      await scanState("submitted-contact")
    })
    await step("Product support complaint receives a stored reference through the mobile form", async () => {
      await call("Emulation.setDeviceMetricsOverride", { width: 360, height: 800, deviceScaleFactor: 1, mobile: true })
      await navigate("/complaints")
      await fill('input[placeholder="John Doe"]', "Synthetic Customer")
      await fill('input[placeholder="john@example.com"]', email)
      await fill('input[type="tel"]', "9000000001")
      await fill('input[placeholder="ORD123456"]', "SARAECOM-00000001")
      await select("main select, form select", "defective")
      await fill('input[placeholder="Product name"]', "Audit Fixture Television")
      await fill('input[placeholder="Brief summary of your issue"]', "Synthetic isolated support request")
      await fill('textarea[placeholder^="Please provide"]', "Synthetic audit of the complaint form. No real customer issue or action requested.")
      await button("Submit Complaint")
      await wait("document.body.innerText.includes('Please upload at least one image for this complaint type')", "required complaint image validation")
      const document = await call("DOM.getDocument")
      const upload = await call("DOM.querySelector", { nodeId: document.root.nodeId, selector: 'input[type="file"]' })
      await call("DOM.setFileInputFiles", { nodeId: upload.nodeId, files: [path.resolve("public\\sara-logo.png")] })
      await wait("document.body.innerText.includes('1/5 images uploaded')", "complaint image preview")
      await scanState("complaint-image-preview")
      await button("Submit Complaint")
      await wait("document.body.innerText.includes('Complaint submitted successfully! Reference ID:')", "stored complaint reference")
      await screenshot("mobile-complaint-submitted")
      await scanState("submitted-complaint")
    })
    await step("Newsletter signup acknowledges the synthetic subscription", async () => {
      await navigate("/")
      await fill("#footer-newsletter", email)
      await click("#footer-newsletter + button")
      await wait("document.body.innerText.includes(\"You're subscribed. Watch your inbox for offers.\")", "newsletter acknowledgement")
      await scanState("subscribed-newsletter")
    })
  } else if (mode === "screens" || mode === "focused" || mode === "category") {
    await call("Network.clearBrowserCookies")
    const categories = await fetch(`${base}/api/categories`).then(r => r.json())
    const category = (Array.isArray(categories) ? categories : categories.categories).find(c => c.name === "Electronics")
    assert.ok(category?.id, "Synthetic category route must resolve a real fixture")
    const routes = mode === "category" ? [`/category/${category.id}`] : mode === "focused" ? [
      "/products", "/product/audit-fixture-television", `/category/${category.id}`,
      "/search?q=Audit", "/offers", "/subham",
    ] : ["/", "/products", "/product/audit-fixture-television", "/brands", "/brands/audit-fixture",
      `/category/${category.id}`, "/search?q=Audit", "/cart", "/checkout", "/wishlist", "/compare",
      "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/offers", "/software",
      "/stores", "/store-locator", "/about", "/contact", "/faq", "/complaints", "/track", "/rewards",
      "/privacy-policy", "/terms-and-conditions", "/shipping-policy", "/returns", "/cancellation-policy",
      "/warranty", "/installation", "/emi", "/business-enquiries", "/careers", "/blog", "/press",
      "/corporate-information", "/disclaimer", "/sitemap", "/brand-guidelines", "/credits",
      "/bosch", "/haier", "/lg", "/tcl", "/epic-sale", "/subham", "/ganesh", "/spin", "/spin/terms",
      "/lucky-draw", "/thank-you", "/register/complete", "/not-a-real-audit-page"]
    for (const [width, height] of viewports) {
      await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 })
      for (const route of routes) {
        await measure(route, width, height)
        if (mode === "category" && width === 1024) {
          await step("Category price controls have unobscured touch targets and filter catalogue products", async () => {
            const thumbs = await evaluate("[...document.querySelectorAll('[role=slider]')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})")
            assert.equal(thumbs.length, 2)
            assert.ok(thumbs.every(r => r.width >= 24 && r.height >= 24))
            assert.ok(thumbs[0].y + thumbs[0].height <= thumbs[1].y || thumbs[1].y + thumbs[1].height <= thumbs[0].y)
            await fill("#max-price", "6000")
            await wait("document.body.innerText.includes('Audit Fixture Television') && !document.body.innerText.includes('Audit Fixture Television Two')", "category maximum-price filter")
            await scanState("category-price-filtered")
          })
        }
      }
    }
  } else throw new Error("Unknown customer browser audit mode")
  save()
} finally {
  save()
  await call("Page.close").catch(() => {})
  socket.close()
}
