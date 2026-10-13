import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import crypto from "node:crypto"
import { createRequire } from "node:module"
import ts from "typescript"

const require = createRequire(import.meta.url)
const root = path.resolve(import.meta.dirname, "..")

// Tests execute the actual TypeScript with explicit infrastructure boundaries,
// never the configured database or a real OAuth, payment or messaging provider.
export function sourceLoader(overrides = {}, globals = {}) {
  const cache = new Map()
  const env = {
    NODE_ENV: "test", SESSION_SECRET: crypto.randomBytes(32).toString("hex"),
    RAZORPAY_KEY_SECRET: crypto.randomBytes(32).toString("hex"),
    GOOGLE_CLIENT_ID: crypto.randomUUID(), GOOGLE_CLIENT_SECRET: crypto.randomUUID(),
    ...globals.env,
  }
  const context = vm.createContext({
    console, Buffer, Error, SyntaxError, TypeError, RangeError, TextEncoder, TextDecoder, URL, URLSearchParams, Headers, Request, Response, ReadableStream, AbortSignal, AbortController,
    crypto: crypto.webcrypto, btoa, atob, setTimeout, clearTimeout,
    process: { env, cwd: () => root },
    fetch: globals.fetch || (() => { throw new Error("Unexpected external network request in isolated test") }),
    ...globals.context,
  })
  const defaults = {
    "@/lib/mongodb": { connectToDatabase: () => { throw new Error("Unexpected real database access in isolated test") } },
    "@/lib/email": { sendEmail: async () => ({ success: true }) },
  }
  function load(filename) {
    const absolute = path.resolve(root, filename)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const loadedModule = { exports: {} }
    cache.set(absolute, loadedModule)
    const source = fs.readFileSync(absolute, "utf8")
    const javascript = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
      fileName: absolute,
    }).outputText
    const localRequire = (specifier) => {
      if (Object.hasOwn(overrides, specifier)) return overrides[specifier]
      if (Object.hasOwn(defaults, specifier)) return defaults[specifier]
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, specifier.slice(2)) : path.resolve(path.dirname(absolute), specifier)
        const alias = `@/${path.relative(root, target).split(path.sep).join("/")}`
        if (Object.hasOwn(overrides, alias)) return overrides[alias]
        if (Object.hasOwn(defaults, alias)) return defaults[alias]
        for (const extension of ["", ".ts", ".tsx", ".js"]) {
          if (fs.existsSync(target + extension) && fs.statSync(target + extension).isFile()) {
            return load(target + extension)
          }
        }
        throw new Error(`Unresolved test module: ${specifier}`)
      }
      return require(specifier)
    }
    const wrapper = vm.runInContext(`(function(require, module, exports) { ${javascript}\n })`, context, { filename: absolute })
    wrapper(localRequire, loadedModule, loadedModule.exports)
    return loadedModule.exports
  }
  return { load, env }
}
