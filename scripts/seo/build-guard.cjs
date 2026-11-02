// Build-only guard. Never load local secret files, connect a DB or call providers.
const fs = require("node:fs")
const path = require("node:path")
const Module = require("node:module")
const originalRead = fs.readFileSync
fs.readFileSync = function (file, options) {
  const name = typeof file === "string" ? path.basename(file) : ""
  if (name === ".env" || name.startsWith(".env.")) return typeof options === "string" || options?.encoding ? "" : Buffer.from("")
  return originalRead.call(this, file, options)
}
const deny = () => { throw new Error("SEO isolated build guard: database/provider access refused") }
const { fixtureDatabase } = require("./build-fixtures.cjs")
function assertFixtureClient(client) {
  const uri = process.env.MONGODB_URI
  if (process.env.SARA_SEO_BUILD_FIXTURES !== "catalogue-v2" || !uri || client.s?.url !== uri) return deny()
  const target = new URL(uri)
  if (target.protocol !== "mongodb:" || !target.hostname.endsWith(".invalid") || target.username || target.password) return deny()
}
const fonts = new Set(["fonts.googleapis.com", "fonts.gstatic.com"])
function fontRequest(input, options = {}) {
  const target = typeof input === "string" || input instanceof URL ? new URL(input) : input
  const method = String(options.method || target?.method || "GET").toUpperCase()
  return target && fonts.has(target.hostname || target.host) && (!target.protocol || target.protocol === "https:") && (!target.port || Number(target.port) === 443) && ["GET", "HEAD"].includes(method)
}
const load = Module._load
Module._load = function (request, parent, isMain) {
  const value = load.call(this, request, parent, isMain)
  if (request === "mongodb") {
    value.MongoClient.prototype.connect = async function () { assertFixtureClient(this); return this }
    value.MongoClient.prototype.db = function () { assertFixtureClient(this); return fixtureDatabase(deny) }
    value.MongoClient.connect = deny
  }
  return value
}
require("node:http").request = deny
require("node:http").get = deny
const https = require("node:https")
const originalRequest = https.request
https.request = function (input, ...args) {
  if (!fontRequest(input, typeof args[0] === "object" ? args[0] : {})) return deny()
  return originalRequest.call(this, input, ...args)
}
https.get = function (input, ...args) { const request = https.request(input, ...args); request.end(); return request }
const socket = require("node:net").Socket.prototype
const originalConnect = socket.connect
socket.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0]
  if (!options || typeof options !== "object" || !fonts.has(options.host || options.hostname) || Number(options.port) !== 443) return deny()
  return originalConnect.apply(this, args)
}
const originalFetch = global.fetch
global.fetch = function (input, options = {}) {
  if (!fontRequest(input, options)) return deny()
  return originalFetch(input, { ...options, credentials: "omit" })
}
