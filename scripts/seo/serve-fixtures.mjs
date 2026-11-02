import { pathToFileURL } from "node:url"
// Local production smoke server. Synthetic data only; no credentials or providers.
import path from "node:path"
import crypto from "node:crypto"
import { spawn } from "node:child_process"
import fs from "node:fs"

const root = path.resolve(import.meta.dirname, "../..")
const env = {}
for (const [key, value] of Object.entries(process.env)) {
  if (["path", "systemroot", "windir", "temp", "tmp", "pathext", "userprofile", "localappdata", "appdata", "comspec"].includes(key.toLowerCase())) env[key] = value
}
Object.assign(env, {
  NODE_ENV: "production", MONGODB_URI: "mongodb://seo-fixture.invalid/synthetic",
  SARA_SEO_BUILD_FIXTURES: "catalogue-v2", SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
  NEXT_DIST_DIR: ".seo-build-check", NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SITE_URL: "https://www.sarastores.com", NEXT_PUBLIC_APP_URL: "https://www.sarastores.com", NEXTAUTH_URL: "https://www.sarastores.com",
  NODE_OPTIONS: `--import "${pathToFileURL(path.join(root, "scripts/seo/build-guard.mjs")).href}"`,
})
const log = fs.createWriteStream(path.join(root, ".seo-local/fixture-server.log"))
const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", "3016"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true })
child.stdout.on("data", data => log.write(data))
child.stderr.on("data", data => log.write(data))
console.log(JSON.stringify({ mode: "synthetic SEO server", port: 3016, pid: child.pid, stop: "write stop to this process stdin" }))
child.on("exit", code => { process.exitCode = code ?? 0; log.end(); process.stdin.pause() })
process.stdin.on("data", data => { if (String(data).trim() === "stop") child.kill() })
process.on("SIGINT", () => child.kill("SIGINT"))
process.on("SIGTERM", () => child.kill("SIGTERM"))
