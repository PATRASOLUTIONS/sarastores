import assert from "node:assert/strict"
import crypto from "node:crypto"
import http from "node:http"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { spawn } from "node:child_process"
import test from "node:test"

const secret = crypto.randomBytes(32).toString("hex")
const env = {
  ...process.env, MONGODB_DB: "ecom_sara_audit_preload", DB_NAME: "ecom_sara_audit_preload",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3012", SMTP_HOST: "127.0.0.1", SMTP_PORT: "1587",
  RAZORPAY_KEY_ID: `rzp_test_audit_${crypto.randomBytes(8).toString("hex")}`,
  RAZORPAY_KEY_SECRET: secret, AUDIT_PROVIDER_SECRET: secret, RECAPTCHA_SECRET_KEY: secret, NODE_OPTIONS: "",
}
const execute = (code, overrides = {}) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["--import", pathToFileURL(path.resolve("scripts\\audit-journey-preload.mjs")).href, "-e", code], { env: { ...env, ...overrides } })
  let output = ""
  child.stdout.on("data", chunk => { output += chunk })
  child.stderr.on("data", chunk => { output += chunk })
  child.on("error", reject)
  child.on("exit", status => resolve({ status, output }))
})
test("audit preload rejects a live database before app execution", async () => {
  const result = await execute("throw Error('App must not execute')", { MONGODB_DB: "e-commerce-bytewise" })
  assert.notEqual(result.status, 0)
  assert.match(result.output, /explicitly isolated database/)
  assert.doesNotMatch(result.output, /App must not execute/)
})
test("audit preload fails closed for all external transports and non-isolated database selection", async () => {
  const result = await execute(`
    const assert=require('node:assert/strict');
    const {MongoClient}=require('mongodb');
    assert.throws(()=>MongoClient.prototype.db.call(null,'e-commerce-bytewise'),/non-isolated/);
    assert.throws(()=>fetch('https://example.invalid'),/blocked external/);
    assert.throws(()=>fetch(new Request('https://images.unsplash.com/photo-fixture',{method:'POST',body:'synthetic'})),/blocked external/);
    assert.throws(()=>fetch('https://fonts.googleapis.com/css',{headers:{authorization:'synthetic'}}),/blocked external/);
    for(const name of ['http','https'])for(const method of ['get','request'])
      assert.throws(()=>require('node:'+name)[method]('https://example.invalid'),/blocked external/);
    fetch('https://www.google.com/recaptcha/api/siteverify',{body:new URLSearchParams({response:'audit-browser-token',secret:process.env.RECAPTCHA_SECRET_KEY})})
      .then(r=>r.json()).then(r=>assert.equal(r.success,true));
  `)
  assert.equal(result.status, 0, result.output)
})
test("audit preload forwards SDK orders and fetch-based offers to a local sink without recursion", async () => {
  const server = http.createServer((req, res) => {
    assert.ok(["/v1/orders", "/v1/offers"].includes(req.url))
    assert.equal(req.headers["x-audit-secret"], secret)
    res.end(JSON.stringify(req.url === "/v1/offers" ? { items: [] } : { id: "order_audit_fixture" }))
  })
  await new Promise((resolve, reject) => server.once("error", reject).listen(1598, "127.0.0.1", resolve))
  // Use a separate fixture port so this test can run while the journey provider is active.
  const proxy = http.createServer((req, res) => {
    const request = http.request({ hostname: "127.0.0.1", port: 1598, path: req.url, method: req.method, headers: req.headers }, response => response.pipe(res))
    req.pipe(request)
  })
  try {
    // The guarded preload intentionally fixes the provider port at 1588.
    const existing = await fetch("http://127.0.0.1:1588/audit/status").catch(() => null)
    if (existing?.ok) {
      const result = await execute(`const assert=require('node:assert/strict');const r=require('node:https').request({hostname:'api.razorpay.com',path:'/v1/orders',method:'POST'},res=>{assert.equal(res.statusCode,400);res.resume()});r.end('{}');fetch('https://api.razorpay.com/v1/offers').then(res=>{assert.equal(res.status,400)})`)
      assert.equal(result.status, 0, result.output)
    } else {
      await new Promise((resolve, reject) => proxy.once("error", reject).listen(1588, "127.0.0.1", resolve))
      const result = await execute(`const assert=require('node:assert/strict');const r=require('node:https').request({hostname:'api.razorpay.com',path:'/v1/orders',method:'POST'},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>assert.equal(JSON.parse(b).id,'order_audit_fixture'))});r.end('{}');fetch('https://api.razorpay.com/v1/offers').then(res=>res.json()).then(data=>assert.deepEqual(data.items,[]))`)
      assert.equal(result.status, 0, result.output)
    }
  } finally {
    await new Promise(resolve => server.close(resolve))
    if (proxy.listening) await new Promise(resolve => proxy.close(resolve))
  }
})
