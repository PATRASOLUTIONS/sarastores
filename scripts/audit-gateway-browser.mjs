import assert from "node:assert/strict"
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const base = "http://localhost:3025"
const output = path.resolve("documents\\payment-ui-journeys")
const fixtures = "http://127.0.0.1:1588"
const offline = process.argv[2] === "render"
const evidencePath = path.join(output, "results.json")
const status = offline ? JSON.parse(fs.readFileSync(evidencePath, "utf8")) : await fetch(`${fixtures}/audit/status`).then(r => r.json())
if (!offline) assert.equal(status.database, process.argv[2], "Browser must use the explicitly named isolated database")
assert.match(status.database, /^ecom_sara_audit_/)
fs.mkdirSync(path.join(output, "screenshots"), { recursive: true })
const report = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, "utf8")) : {
  base, database: status.database, startedAt: new Date().toISOString(),
  safety: "SIMULATED provider boundaries; real local UI, authentication, pricing, callback verification and isolated database persistence. No real payment or live email.",
  journeys: [],
}
assert.equal(report.database, status.database)
report.environmentIssues ||= []
const filter = process.argv[3]
const target = offline ? null : await fetch("http://localhost:9226/json/new?about:blank", { method: "PUT" }).then(r => r.json())
const socket = offline ? null : new WebSocket(target.webSocketDebuggerUrl)
if (socket) await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true })
  socket.addEventListener("error", reject, { once: true })
})
let sequence = 0
const pending = new Map()
let events = []
const toolingErrors = []
function call(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 90000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  return result.result.value
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function wait(expression, label, timeout = 60000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return
    await pause(250)
  }
  throw new Error(`UI wait failed: ${label}`)
}
async function navigate(route) {
  for (let attempt = 1; attempt <= 3; attempt++) {
  const start = events.length
  const result = await call("Page.navigate", { url: route.startsWith("http") ? route : base + route })
  assert.ok(!result.errorText, result.errorText)
  if (result.loaderId) {
    const deadline = Date.now() + 60000
    while (!events.slice(start).some(e => e.method === "Page.frameNavigated" && e.params.frame.loaderId === result.loaderId)) {
      assert.ok(Date.now() < deadline, "Navigation did not commit")
      await pause(100)
    }
  }
  await wait("document.readyState === 'complete'", "document load")
  const failed = events.slice(start).find(e => e.method === "Network.responseReceived" && e.params.type === "Document" && e.params.response.status >= 500)
  if (failed) {
    const issue = { at: new Date().toISOString(), path: new URL(failed.params.response.url).pathname,
      status: failed.params.response.status, description: "Next.js development server returned a page error; browser navigation was retried.", attempt }
    report.environmentIssues.push(issue)
    console.warn("Development page error:", issue.path, issue.status, "attempt", attempt)
    if (attempt === 3) throw new Error(`Development page still failing: ${issue.path}`)
    await pause(3000)
    continue
  }
  await wait("document.body.innerText.length > 30", "rendered page")
  await pause(4500)
  return
  }
}
async function click(selector) {
  await evaluate(`(() => {
    const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length);
    if(!e)throw Error('Missing visible control');e.scrollIntoView({block:'center',behavior:'instant'});
  })()`)
  await pause(300)
  const point = await evaluate(`(() => {
    const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length);
    if(!e)throw Error('Missing visible control: '+${JSON.stringify(selector)});
    const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;
    const hit=document.elementFromPoint(x,y);if(hit!==e&&!e.contains(hit))throw Error('Control obscured: '+${JSON.stringify(selector)});
    return {x,y};
  })()`)
  await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...point })
  await call("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 })
  await pause(100)
  await call("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 })
  await pause(250)
}
async function button(text) {
  await evaluate(`(() => {
    document.querySelectorAll('[data-journey-target]').forEach(e=>e.removeAttribute('data-journey-target'));
    const e=[...document.querySelectorAll('button,a')].find(e=>e.getClientRects().length&&e.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if(!e)throw Error('Missing button: '+${JSON.stringify(text)});e.dataset.journeyTarget='click';
  })()`)
  await wait("!document.querySelector('[data-journey-target=\"click\"]')?.disabled", "enabled action")
  await evaluate("document.querySelector('[data-journey-target=\"click\"]').click()")
  await pause(250)
}
async function fill(selector, value) {
  await evaluate(`(() => {const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.getClientRects().length);
    if(!e)throw Error('Missing visible field: '+${JSON.stringify(selector)});e.focus();e.select?.();})()`)
  await call("Input.insertText", { text: value })
  await pause(200)
}
async function key(key, code, windowsVirtualKeyCode) {
  await call("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode })
  await call("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode })
  await pause(250)
}
async function check(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await key(" ", "Space", 32)
  await wait(`document.querySelector(${JSON.stringify(selector)}).checked`, "consent selected", 3000)
}
async function select(selector, value) {
  await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});
    e.dispatchEvent(new Event('change',{bubbles:true}));})()`)
}
const widget = `window.Razorpay=class {
  constructor(options){this.options=options}
  open(){
    const options=this.options;
    const dialog=document.createElement('div');
    dialog.id='audit-provider-dialog';dialog.role='dialog';dialog.setAttribute('aria-label','SIMULATED Razorpay checkout');
    dialog.style.cssText='position:fixed;z-index:2147483647;inset:12%;background:white;padding:24px;border:4px solid #0f2557;color:#111;overflow:auto';
    dialog.innerHTML='<h2>SIMULATED Razorpay checkout</h2><p>Local fixture. No money will be charged. This is not the real Razorpay sandbox.</p><button id="audit-pay-success">Simulate successful payment</button>';
    document.body.append(dialog);
    document.getElementById('audit-pay-success').onclick=()=>{
      const id=Math.random().toString(36);
      const listener=async event=>{if(event.detail.id!==id)return;window.removeEventListener('audit-payment-result',listener);dialog.remove();await options.handler(event.detail.proof)};
      window.addEventListener('audit-payment-result',listener);
      window.auditPayment(JSON.stringify({id,provider:'razorpay',orderId:options.order_id}));
    };
  }
};`
function hostedPage(provider, orderId) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SIMULATED ${provider} checkout</title><body style="font:18px/1.6 Arial,sans-serif;background:#f4f7fb;color:#0f2557;padding:20px">
  <main style="max-width:650px;margin:30px auto;background:white;padding:24px;border:4px solid #0f2557">
  <h1>SIMULATED ${provider === "pinelabs" ? "Pine Labs" : "Paytm"} checkout</h1>
  <p>Local fixture intercepted by Chrome. No real payment gateway was contacted and no money will be charged.</p>
  <p>The real app created a pending order with two products. Continue to simulate capture and submit a signed callback to the real local application.</p>
  <button id="audit-pay-success" style="padding:16px;font:inherit">Simulate successful payment</button></main>
  <script>document.getElementById('audit-pay-success').onclick=()=>window.auditPayment(${JSON.stringify(JSON.stringify({ provider, orderId }))});</script></body></html>`
}
socket?.addEventListener("message", ({ data }) => {
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
    let response, type
    if (url.hostname === "www.google.com" && url.pathname === "/recaptcha/api.js") {
      response = "window.grecaptcha={ready:cb=>cb(),execute:async()=> 'audit-browser-token'};"
      type = "application/javascript"
    } else if (url.hostname === "checkout.razorpay.com" && url.pathname === "/v1/checkout.js") {
      response = widget; type = "application/javascript"
    } else if (url.hostname === "api.pluralonline.com" && url.pathname.startsWith("/audit-checkout/")) {
      response = hostedPage("pinelabs", url.pathname.split("/").at(-1)); type = "text/html"
    } else if (url.hostname === "securestage.paytmpayments.com" && url.pathname === "/theia/api/v1/showPaymentPage") {
      assert.equal(request.method, "POST")
      response = hostedPage("paytm", url.searchParams.get("orderId")); type = "text/html"
    }
    let operation
    if (response) operation = call("Fetch.fulfillRequest", { requestId, responseCode: 200,
      responseHeaders: [{ name: "content-type", value: type }], body: Buffer.from(response).toString("base64") })
    else if (["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "3025") operation = call("Fetch.continueRequest", { requestId })
    else if (["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname) && request.method === "GET") operation = call("Fetch.continueRequest", { requestId })
    else operation = call("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" })
    void operation.catch(error => { if (!/InterceptionId|Invalid interception/.test(error.message)) toolingErrors.push(error.message) })
  }
  if (message.method === "Runtime.bindingCalled" && message.params.name === "auditPayment") {
    void (async () => {
      const request = JSON.parse(message.params.payload)
      const response = await fetch(`${fixtures}/audit/${request.provider === "razorpay" ? "payments" : "capture"}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request),
      })
      assert.ok(response.ok, "Local simulated capture rejected")
      const proof = await response.json()
      if (request.provider === "razorpay") await evaluate(`window.dispatchEvent(new CustomEvent('audit-payment-result',{detail:${JSON.stringify({ id: request.id, proof })}}))`)
      else {
        assert.equal(proof.callbackUrl, `${base}/api/payment/${request.provider}/return`)
        await evaluate(`(() => {const form=document.createElement('form');form.method='POST';form.action=${JSON.stringify(proof.callbackUrl)};
          for(const [name,value] of Object.entries(${JSON.stringify(proof.fields)})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input)}
          document.body.append(form);form.submit();})()`)
      }
    })().catch(error => { toolingErrors.push(error.message); console.error("Capture tooling:", error.message) })
  }
})
const escape = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
function save() {
  report.updatedAt = new Date().toISOString()
  report.toolingErrors = toolingErrors
  fs.writeFileSync(evidencePath, JSON.stringify(report, null, 2))
  const passed = report.journeys.filter(j => j.proof && j.steps.every(s => s.passed)).length
  fs.writeFileSync(path.join(output, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SARA - six simulated payment UI journeys</title><style>
  *{box-sizing:border-box}body{margin:0;font:16px/1.6 "Segoe UI",Arial,sans-serif;color:#17243b;background:#f4f7fb}
  header{background:#0f2557;color:white;padding:32px}main{max-width:1150px;margin:auto;padding:24px}
  a{color:#1357a5}header a{color:white}.notice{background:#fff3cf;border:2px solid #b77900;padding:20px;border-radius:8px}
  section,article{background:white;padding:20px;border:1px solid #cbd5e1;border-radius:8px;margin:20px 0}
  nav{display:flex;flex-wrap:wrap;gap:16px;margin:20px 0}table{border-collapse:collapse;width:100%}td,th{padding:10px;border:1px solid #cbd5e1;text-align:left}
  .steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.steps article{margin:0}
  img{display:block;max-width:100%;max-height:600px;margin:12px auto;border:1px solid #cbd5e1;object-fit:contain}
  code,pre{overflow-wrap:anywhere;white-space:pre-wrap}h1,h2,h3{line-height:1.25}.pass{color:#166534}.fail{color:#b91c1c}
  @media(max-width:700px){.steps{grid-template-columns:1fr}main{padding:12px}header{padding:20px}.table{overflow:auto}}
  </style></head><body><header><h1>Payment UI journeys - desktop &amp; mobile</h1>
  <p>${passed}/6 complete simulated journeys verified on <strong>port 3025</strong>. Chrome desktop 1440 x 1000 and mobile 390 x 844 (emulated viewport/touch, not a physical device).</p>
  <a href="../index.html">Internal document catalogue</a></header><main>
  <div class="notice"><strong>SIMULATION, NOT REAL GATEWAY SANDBOX CERTIFICATION.</strong> ${escape(report.safety)}
  CAPTCHA browser/server validation, email delivery and gateway SDK/hosted pages/provider API responses were replaced with local fixtures.
  Actual registration, verification tokens, login/session cookies, product search, two-product cart, address saving, server pricing,
  HMAC/Paytm checksum checks, provider status lookup, order/payment persistence, confirmation and cart cleanup ran in the application.</div>
  <section><h2>Credentials and scope</h2><p>Existing local credentials were not used or changed. Runtime fixtures use random synthetic keys.
  Real Pine Labs UAT completion remains blocked by the missing <code>PINELABS_CALLBACK_SECRET</code> signing key.
  Real Paytm staging completion requires merchant-issued <code>PAYTM_MERCHANT_ID</code> and the 16-byte <code>PAYTM_MERCHANT_KEY</code>;
  they are not public shared test credentials. No third-party merchant secrets were obtained.</p>
  <p><a href="https://www.paytmpayments.com/docs/testing-integration/">Official Paytm testing guide</a> describes staging test instruments and success/failure simulations.
  <a href="https://www.paytmpayments.com/docs/api/initiate-transaction-api/">Official Initiate Transaction API</a>,
  <a href="https://www.paytmpayments.com/docs/api-keys/">merchant API-key documentation</a>.
  Public test instruments do not replace onboarding/dashboard merchant keys; these journeys did not use card details.</p>
  <p>All screenshots contain synthetic data only. External analytics/payment/CAPTCHA network requests were blocked or intercepted.
  Browser automation uses native text input, keyboard consent, native pointer product selection, and DOM activation of actual visible form buttons.
  Development-navigation retries were needed; completed steps were retained and failed steps re-run against the same synthetic account.
  No business handlers or authentication/payment checks were bypassed.
  This is development-mode functional evidence, not performance, real-bank settlement, or a full gateway failure/idempotency audit.</p></section>
  <section><h2>Results</h2><div class="table"><table><thead><tr><th>Journey</th><th>Result</th><th>Order</th><th>Persisted total</th></tr></thead><tbody>
  ${report.journeys.map(j => `<tr><td><a href="#${escape(j.id)}">${escape(j.id)}</a></td><td>${j.proof && j.steps.every(s => s.passed) ? "PASS (simulated)" : "INCOMPLETE / FAILED"}</td><td>${escape(j.proof?.orderId || "-")}</td><td>${j.proof ? `INR ${j.proof.amount.toFixed(2)}` : "-"}</td></tr>`).join("")}
  </tbody></table></div><p>Generated ${escape(report.updatedAt)}. <a href="results.json">Machine-readable evidence</a>.</p></section>
  <section><h2>Observed development-environment issues</h2><p>The Windows Next.js dev server intermittently returned
  <code>SyntaxError: Unexpected end of JSON input</code> while loading generated manifests. It was restarted once, and affected page navigations were retried.
  Some cart-to-checkout activations also needed a cart reload/retry. Passing final journeys below establish eventual functional completion,
  not an error-free first attempt or production stability. These symptoms were not fixed in application code.</p>
  ${report.environmentIssues.length ? `<ul>${report.environmentIssues.map(issue => `<li>${escape(issue.at)}: ${escape(issue.path)} HTTP ${issue.status}; retry ${issue.attempt}.</li>`).join("")}</ul>` : ""}
  </section>
  <nav>${report.journeys.map(j => `<a href="#${escape(j.id)}">${escape(j.id)}</a>`).join("")}</nav>
  ${report.journeys.map(j => `<section id="${escape(j.id)}"><h2>${escape(j.id)} - ${j.width} x ${j.height}</h2>
  <p>Started ${escape(j.startedAt)}. Each screenshot was captured after the asserted UI state. Click to open full resolution.</p>
  ${j.proof ? `<p class="pass"><strong>Database verified:</strong> ${escape(j.proof.orderId)}; confirmed order; completed payment;
  two items, one each; INR ${j.proof.amount.toFixed(2)}; payment record persisted; checkout intent consumed; cart cleared; account email verified.</p>` : ""}
  <div class="steps">${j.steps.map((s, i) => `<article><h3>${i + 1}. ${escape(s.label)}</h3>
  <p class="${s.passed ? "pass" : "fail"}"><strong>${s.passed ? "PASS" : "FAIL"}</strong> ${escape(s.description)}</p>
  ${s.retries ? `<p>Required ${s.retries} cart reload/retry attempt(s) before navigation completed.</p>` : ""}
  ${s.error ? `<pre>${escape(s.error)}</pre>` : ""}<p>UI path: <code>${escape(s.path || "-")}</code></p>
  ${s.screenshot ? `<a href="${escape(s.screenshot)}"><img loading="lazy" src="${escape(s.screenshot)}" alt="${escape(j.id + ": " + s.label)}"></a>` : ""}
  </article>`).join("")}</div></section>`).join("")}
  <section><h2>Reproduce safely</h2><p>Use a fresh explicitly isolated database name under <code>ecom_sara_audit_</code>, never the live store database.
  Start <code>node scripts\\audit-journey-server.mjs &lt;isolated-db&gt; gateways</code>, launch a dedicated Chrome profile with debugging port 9226,
  then run <code>node scripts\\audit-gateway-browser.mjs &lt;isolated-db&gt;</code>. Ports 3025, 1587 and 1588 must be free.
  The fixture server redirects all payment provider calls locally and refuses non-isolated DB access in the application.
  After stopping the owned processes, run <code>node scripts\\audit-journey-server.mjs &lt;isolated-db&gt; cleanup</code> to remove the marker-guarded synthetic records.</p>
  <p>${escape(report.cleanup || "Owned fixture resources will be cleaned after final verification.")}</p></section></main></body></html>`)
}
if (offline) {
  assert.equal(report.journeys.length, 6)
  assert.ok(report.journeys.every(j => j.proof && j.steps.length === 19 && j.steps.every(s => s.passed)))
  if (process.argv[3]) report.cleanup = process.argv[3]
  save()
  console.log("Six-journey offline HTML report rendered.")
} else {
await call("Page.enable")
await call("Page.bringToFront")
await call("Runtime.enable")
await call("Network.enable")
await call("Runtime.addBinding", { name: "auditPayment" })
await call("Fetch.enable", { patterns: [{ urlPattern: "*" }] })
let active
async function step(label, description, action) {
  if (process.argv[4] === "resume-auth" && active.steps.some(s => s.label === label && s.passed)) return
  const entry = { label, description, passed: false }
  active.steps.push(entry)
  try {
    await action()
    await pause(500)
    entry.passed = true
  } catch (error) {
    entry.error = error.message
    entry.browserErrors = events.filter(e => ["Runtime.exceptionThrown", "Network.loadingFailed"].includes(e.method))
      .map(e => e.method === "Runtime.exceptionThrown" ? e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text : e.params.errorText)
    entry.navigationRequests = events.filter(e => e.method === "Fetch.requestPaused" && e.params.request.url.startsWith(base) && !e.params.request.url.includes("/api/"))
      .map(e => new URL(e.params.request.url).pathname).slice(-12)
    console.error("Failure evidence:", entry.browserErrors, entry.navigationRequests)
  }
  entry.path = await evaluate("location.pathname").catch(() => "-")
  const filename = `${active.id}-${String(active.steps.length).padStart(2, "0")}.png`
  const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false })
  fs.writeFileSync(path.join(output, "screenshots", filename), Buffer.from(screenshot.data, "base64"))
  entry.screenshot = `screenshots/${filename}`
  entry.apiResponses = events.filter(e => e.method === "Network.responseReceived" && e.params.response.url.startsWith(base + "/api/"))
    .map(e => ({ path: new URL(e.params.response.url).pathname, status: e.params.response.status }))
  events = []
  save()
  console.log(`${entry.passed ? "PASS" : "FAIL"} ${active.id}: ${label}`)
  if (!entry.passed) {
    console.error(await evaluate("document.body.innerText.slice(-4500)"))
    throw new Error(entry.error)
  }
}
try {
  for (const device of ["desktop", "mobile"]) for (const provider of ["razorpay", "pinelabs", "paytm"]) {
    const id = `${device}-${provider}`
    if (filter && filter !== id) continue
    if (report.journeys.some(j => j.id === id && j.proof && j.steps.every(s => s.passed))) continue
    const resume = process.argv[4] === "resume-auth"
    const previous = report.journeys.find(j => j.id === id)
    report.journeys = report.journeys.filter(j => j.id !== id)
    active = resume ? previous : { id, provider, width: device === "desktop" ? 1440 : 390, height: device === "desktop" ? 1000 : 844,
      startedAt: new Date().toISOString(), steps: [] }
    if (resume) {
      assert.ok(active.steps.slice(0, 6).every(s => s.passed))
      active.steps = active.steps.filter(s => s.passed)
    }
    report.journeys.push(active)
    let email = `${id}-${crypto.randomBytes(5).toString("hex")}@example.invalid`
    const password = crypto.randomBytes(15).toString("base64url") + "Aa9!"
    if (!resume) await call("Network.clearBrowserCookies")
    await call("Network.setExtraHTTPHeaders", { headers: { "x-forwarded-for": `192.0.2.${report.journeys.length + 10}` } })
    await call("Emulation.setDeviceMetricsOverride", { width: active.width, height: active.height, deviceScaleFactor: 1, mobile: device === "mobile" })
    await call("Emulation.setTouchEmulationEnabled", { enabled: device === "mobile", maxTouchPoints: 1 })
    if (!resume) {
    await navigate("/")
    await evaluate("localStorage.clear();sessionStorage.clear()")
    await step("Landing page", "Open the storefront with a fresh browser state and reject optional cookies.", async () => {
      await navigate("/")
      if (await evaluate("[...document.querySelectorAll('button')].some(e=>e.textContent.trim()==='Reject all')")) await button("Reject all")
      assert.ok(await evaluate("document.querySelector('header') && document.body.innerText.length>100"))
    })
    await step("Register account", "Fill the real registration form with synthetic details and required terms/privacy consent; CAPTCHA is simulated.", async () => {
      await navigate("/register")
      await fill("#name", "Synthetic Gateway Customer"); await fill("#email", email)
      await fill("#password", password); await fill("#confirmPassword", password)
      await check('[name="agreeToTerms"]'); await check('[name="agreePrivacyNotice"]')
      await wait("document.querySelector('[name=agreeToTerms]').checked&&document.querySelector('[name=agreePrivacyNotice]').checked", "required consent controls checked", 3000)
      await pause(3400)
    })
    await step("Submit registration", "Submit Create Account and verify the application advances to email verification or its login screen.", async () => {
      await button("Create Account")
      await wait("location.pathname !== '/register'", "registration completion")
      await wait("/verify|verification/i.test(document.body.innerText)||location.pathname==='/login'", "registration next screen")
    })
    await step("Verify email", "Follow the real verification link captured by the local-only SMTP sink.", async () => {
      const messages = await fetch(`${fixtures}/audit/messages`).then(r => r.json())
      const mail = messages.filter(m => m.recipients.includes(email)).reverse().find(m => m.raw.includes("verify-email"))
      assert.ok(mail, "Verification email captured")
      const decoded = mail.raw.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
      const link = decoded.match(/http:\/\/localhost:3025\/[^"\s<>]*verify-email[^"\s<>]*/)?.[0]
      assert.ok(link)
      await navigate(link.replaceAll("&amp;", "&"))
      await wait("/verified|success/i.test(document.body.innerText)", "email verification success")
    })
    await step("Login form", "Enter the newly registered account email/password in the real login form.", async () => {
      await navigate("/login"); await fill("#email", email); await fill("#password", password); await pause(3400)
    })
    await step("Login succeeds", "Submit Sign In and confirm the server session belongs to the verified synthetic user.", async () => {
      await button("Sign In")
      await wait("location.pathname !== '/login'", "login success")
      assert.equal(await evaluate(`fetch('/api/auth/session').then(r=>r.json()).then(d=>d.user?.email===${JSON.stringify(email)})`), true)
    })
    } else {
      await navigate(active.steps.at(-1).path)
      email = await evaluate("fetch('/api/auth/session').then(r=>r.json()).then(d=>d.user?.email)")
      assert.match(email || "", /@example\.invalid$/)
    }
    await step("Search products", "Use the storefront search UI to search for Audit and verify both catalogue fixtures are returned.", async () => {
      await navigate("/")
      await fill('input[placeholder*="Search for products"]', "Audit")
      await pause(800)
      await evaluate("[...document.querySelectorAll('button[aria-label=\"Search\"]')].find(e=>e.getClientRects().length).click()")
      await wait("location.pathname==='/products'&&new URLSearchParams(location.search).get('search')==='Audit'", "search navigation")
      await wait("document.body.innerText.includes('Audit Fixture Television Two')", "two search matches")
    })
    for (const [number, slug] of [[1, "audit-fixture-television"], [2, "audit-fixture-television-two"]]) {
      await step(`Select product ${number}`, `Open the ${number === 1 ? "INR 4,999" : "INR 6,999"} synthetic television detail page.`, async () => {
        if (number === 2) await navigate("/products?search=Audit")
        await click(`a[href="/product/${slug}"]`)
        await wait(`location.pathname==='/product/${slug}'`, "product detail navigation")
        await wait("[...document.querySelectorAll('button')].some(e=>e.textContent.includes('Add to Cart'))", "detail loaded")
        await pause(1800)
      })
      await step(`Add product ${number} to cart`, "Click the real Add to Cart control; no cart data is injected by the runner.", async () => {
        await button("Add to Cart"); await pause(1800)
      })
    }
    await step("Two-product cart", "Open the cart and verify both distinct products, quantity one each, are present.", async () => {
      await navigate("/cart")
      await wait("document.body.innerText.includes('Audit Fixture Television Two')", "cart populated")
      assert.deepEqual(await evaluate("[...document.querySelectorAll('[aria-label^=\"Quantity for\"]')].map(e=>e.textContent.trim())"), ["1", "1"])
    })
    await step("Checkout", "Use the cart checkout control to enter authenticated checkout.", async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        await button("Proceed to Checkout")
        try {
          await wait("location.pathname==='/checkout'", "checkout navigation", 15000)
          break
        } catch (error) {
          if (attempt === 3) throw error
          console.warn(`Checkout navigation attempt ${attempt} did not complete; reloading the cart and retrying its real control.`)
          active.steps.at(-1).retries = attempt
          await navigate("/cart")
        }
      }
      await wait("!!document.querySelector('#firstName')", "delivery form")
    })
    await step("Delivery address", "Fill synthetic customer/address data and save Bangalore delivery, pincode 560001.", async () => {
      await fill("#firstName", "Synthetic"); await fill("#lastName", "Customer")
      await fill("#email", email); await fill("#phone", "9000000001"); await fill("#address", "123 Synthetic Audit Street")
      await select("#state", "Karnataka")
      await select("#city", "Bangalore"); await fill("#pincode", "560001")
      await button("Save delivery address")
      await wait("!document.querySelector('#firstName')?.getClientRects().length", "saved address")
    })
    await step("Choose payment gateway", `Select ${provider} and verify the checkout branding matches the chosen provider.`, async () => {
      await wait(`!!document.querySelector('select option[value="${provider}"]')`, "gateway options")
      await select(`select:has(option[value="${provider}"])`, provider)
      await wait(`document.body.innerText.includes('Processed through ${provider === "razorpay" ? "Razorpay" : provider === "pinelabs" ? "Pine Labs" : "Paytm"}')`, "provider branding")
    })
    await step("Start simulated payment", "Click Pay Now. The real app calculates the amount; only the provider boundary is simulated.", async () => {
      await button("Pay Now")
      await wait("!!document.querySelector('#audit-pay-success')", "simulated checkout opened")
    })
    await step("Complete payment and confirmation", "Click the labelled simulated success control. The real application verifies signed proof/provider status and displays the two-item order confirmation.", async () => {
      await click("#audit-pay-success")
      await wait("document.body.innerText.includes('Order Summary (2 items)')&&document.body.innerText.includes('View order details')", "two-item paid confirmation", 90000)
      assert.ok(await evaluate("document.body.innerText.includes('Audit Fixture Television Two')"))
    })
    await step("Order history", "Open authenticated order history and verify the completed order is visible.", async () => {
      await navigate("/account/orders")
      await wait("/SARAECOM-/.test(document.body.innerText)", "persisted order history")
    })
    await step("Cart cleared and persistence verified", "Reload the cart and verify it is empty; independently assert confirmed order, completed payment, consumed intent, exact paid total and two products in the isolated database.", async () => {
      await navigate("/cart")
      await wait("/cart is empty|empty cart/i.test(document.body.innerText)", "cart cleared")
      const response = await fetch(`${fixtures}/audit/proof`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, provider }) })
      assert.ok(response.ok, "Database payment/persistence assertion failed")
      active.proof = await response.json()
      assert.equal(active.proof.amount, 11998)
      assert.deepEqual(active.proof.items.map(item => item.name).sort(), ["Audit Fixture Television", "Audit Fixture Television Two"])
    })
    assert.equal(toolingErrors.length, 0, toolingErrors.join("; "))
    active.completedAt = new Date().toISOString(); save()
  }
} finally {
  save()
  await call("Page.close").catch(() => {})
  socket.close()
}
}
