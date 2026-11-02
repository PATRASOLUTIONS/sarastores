// Strict local Next build with no database or provider access. No deployment.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import fixtureModule from "./build-fixtures.cjs"

const root = path.resolve(import.meta.dirname, "../..")
const fixtureUri = process.env.SARA_SEO_BUILD_MONGODB_URI
if (!fixtureUri || new URL(fixtureUri).protocol !== "mongodb:" || !new URL(fixtureUri).hostname.endsWith(".invalid")) {
  throw new Error("Set SARA_SEO_BUILD_MONGODB_URI to a synthetic .invalid-host MongoDB URI; no real URI is accepted")
}
const output = path.join(root, ".seo-local")
fs.mkdirSync(output, { recursive: true })
const configPath = path.join(root, "tsconfig.json")
const before = fs.readFileSync(configPath)
const env = {}
for (const [key, value] of Object.entries(process.env)) {
  if (["path", "systemroot", "windir", "temp", "tmp", "pathext", "userprofile", "localappdata", "appdata", "comspec"].includes(key.toLowerCase())) env[key] = value
}
Object.assign(env, {
  NODE_ENV: "production", MONGODB_URI: fixtureUri, SARA_SEO_BUILD_FIXTURES: "catalogue-v2",
  SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  NEXT_PUBLIC_SITE_URL: "https://sarastores.com", NEXT_PUBLIC_APP_URL: "https://sarastores.com", NEXTAUTH_URL: "https://sarastores.com",
  NEXT_DIST_DIR: ".seo-build-check", NEXT_BUILD_CPUS: "1", NEXT_TELEMETRY_DISABLED: "1",
  NODE_OPTIONS: `--require "${path.join(root, "scripts/seo/build-guard.cjs").replaceAll("\\", "/")}"`,
})
const log = fs.createWriteStream(path.join(output, "build.log"))
const npmCli = path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")
if (!fs.existsSync(npmCli)) throw new Error("npm CLI not found beside Node; resolve the installed npm CLI before building")
const child = spawn(process.execPath, [npmCli, "run", "build"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
child.stdout.on("data", data => log.write(data))
child.stderr.on("data", data => log.write(data))
const result = await new Promise(resolve => {
  child.on("error", error => resolve({ exitCode: 1, error: error.name }))
  child.on("exit", (code, signal) => resolve({ exitCode: code ?? 1, signal }))
})
await new Promise(resolve => log.end(resolve))
if (!fs.readFileSync(configPath).equals(before)) fs.writeFileSync(configPath, before)
fs.writeFileSync(path.join(output, "build-result.json"), JSON.stringify({ ...result, fixtureMode: "catalogue-v2", fixtureCollections: fixtureModule.fixtureCollectionNames, databaseConnectionsPermitted: false, providerRequestsPermitted: false, envFilesRead: false, typeAndLintGatesDisabled: false }, null, 2))
console.log(JSON.stringify({ ...result, log: ".seo-local/build.log", databaseConnectionsPermitted: false, envFilesRead: false }))
process.exitCode = result.exitCode
