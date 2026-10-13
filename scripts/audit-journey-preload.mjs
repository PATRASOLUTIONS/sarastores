import http from "node:http"
import https from "node:https"
import { MongoClient } from "mongodb"
const rawHttpRequest = http.request.bind(http)
const publicAssetHosts = new Set(["fonts.googleapis.com", "fonts.gstatic.com", "images.unsplash.com", "m.media-amazon.com"])

const database = process.env.MONGODB_DB
if (!/^ecom_sara_audit_[a-z0-9_]+$/.test(database || "") || Buffer.byteLength(database) > 38 ||
    process.env.DB_NAME !== database || process.env.NEXT_PUBLIC_SITE_URL !== "http://localhost:3012" ||
    process.env.SMTP_HOST !== "127.0.0.1" || process.env.SMTP_PORT !== "1587" ||
    !process.env.RAZORPAY_KEY_ID?.startsWith("rzp_test_audit_") || !process.env.AUDIT_PROVIDER_SECRET ||
    process.env.RAZORPAY_KEY_SECRET !== process.env.AUDIT_PROVIDER_SECRET) {
  throw new Error("Customer audit requires an explicitly isolated database and local-only provider configuration")
}
const db = MongoClient.prototype.db
MongoClient.prototype.db = function (name, options) {
  if (name !== database) throw new Error("Audit refused access to a non-isolated database")
  return db.call(this, name, options)
}

const originalFetch = globalThis.fetch
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url)
  const method = options?.method || input?.method || "GET"
  if (url.href === "https://www.google.com/recaptcha/api/siteverify") {
    const body = new URLSearchParams(options?.body)
    return Promise.resolve(Response.json({
      success: body.get("response") === "audit-browser-token" && body.get("secret") === process.env.RECAPTCHA_SECRET_KEY,
      score: 0.99,
    }))
  }
  if (url.hostname === "api.razorpay.com") {
    const headers = new Headers(options?.headers || input?.headers)
    headers.delete("authorization")
    headers.set("x-audit-secret", process.env.AUDIT_PROVIDER_SECRET)
    return originalFetch(`http://127.0.0.1:1588${url.pathname}${url.search}`, { ...options, method, headers })
  }
  if (publicAssetHosts.has(url.hostname) && method === "GET" && !new Headers(options?.headers || input?.headers).has("authorization")) {
    return originalFetch(input, options)
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) {
    throw new Error(`Audit blocked external fetch to ${url.hostname}`)
  }
  return originalFetch(input, options)
}
for (const transport of [http, https]) {
  const original = transport.request
  transport.request = function (input, options, callback) {
    const isUrl = typeof input === "string" || input instanceof URL
    const params = isUrl ? { ...Object.fromEntries(["hostname", "port", "pathname", "search"].map(key => [key, new URL(input)[key]])), ...(typeof options === "object" ? options : {}) } : { ...input }
    const host = (params.hostname || params.host || "localhost").split(":")[0]
    const cb = typeof options === "function" ? options : callback
    if (publicAssetHosts.has(host) && (!params.method || params.method === "GET") && !params.auth &&
        !new Headers(params.headers).has("authorization")) {
      return original.apply(this, arguments)
    }
    if (host === "api.razorpay.com") {
      return originalHttpRequest({
        ...params, hostname: "127.0.0.1", host: undefined, port: 1588, protocol: "http:",
        path: params.path || `${params.pathname}${params.search || ""}`,
        headers: { ...params.headers, "x-audit-secret": process.env.AUDIT_PROVIDER_SECRET },
      }, cb)
    }
    if (!["localhost", "127.0.0.1", "::1", "["].includes(host)) throw new Error(`Audit blocked external request to ${host}`)
    return original.apply(this, arguments)
  }
  transport.get = function (...args) {
    const request = transport.request(...args)
    request.end()
    return request
  }
}
function originalHttpRequest(options, callback) {
  // Captured before either transport is patched.
  return rawHttpRequest(options, callback)
}
