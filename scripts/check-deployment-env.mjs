import { createRequire } from "node:module"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"
import { MongoClient } from "mongodb"

const email = z.string().email()
const placeholder = /<[^>@]+>|\[not configured|xxxxxxxx|example\.(?:com|invalid)/i

export function checkDeploymentEnvironment(env) {
  const errors = []
  const read = name => typeof env[name] === "string" ? env[name].trim() : ""
  const configured = name => {
    const value = read(name)
    if (!value || placeholder.test(value)) {
      errors.push(`${name}: configure a real value in Vercel Environment Variables`)
      return false
    }
    return true
  }
  const secret = name => {
    if (configured(name) && read(name).length < 32) errors.push(`${name}: use at least 32 characters`)
  }
  const httpsOrigin = name => {
    if (!configured(name)) return null
    try {
      const url = new URL(read(name))
      if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash ||
        ["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"].includes(url.hostname)) throw new Error()
      return url.origin
    } catch {
      errors.push(`${name}: use a public HTTPS origin without credentials, path, query or fragment`)
      return null
    }
  }

  if (configured("MONGODB_URI")) {
    const uri = read("MONGODB_URI")
    if (!uri.startsWith("mongodb+srv://") && !uri.startsWith("mongodb://")) {
      errors.push("MONGODB_URI: use a MongoDB connection URI")
    } else if (uri.startsWith("mongodb://") && !/[?&](?:tls|ssl)=true(?:&|$)/i.test(uri)) {
      errors.push("MONGODB_URI: production connections must enable TLS")
    }
    try {
      new MongoClient(uri)
    } catch {
      errors.push("MONGODB_URI: configure a valid connection URI")
    }
    if (/[?&](?:tls|ssl)=false(?:&|$)|[?&](?:tlsInsecure|tlsAllowInvalidCertificates|tlsAllowInvalidHostnames)=true(?:&|$)/i.test(uri)) {
      errors.push("MONGODB_URI: do not disable TLS or certificate/hostname verification")
    }
  }
  const sessionName = read("SESSION_SECRET") ? "SESSION_SECRET" : "NEXTAUTH_SECRET"
  secret(sessionName)
  secret("CRON_SECRET")
  const origins = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL"].map(httpsOrigin)
  if (origins.every(Boolean) && new Set(origins).size !== 1) errors.push("Site URL variables: all three origins must match")

  for (const name of ["DPDP_LEGAL_ENTITY", "DPDP_REGISTERED_ADDRESS", "DPDP_GRIEVANCE_OFFICER_NAME"]) configured(name)
  if (configured("DPDP_GRIEVANCE_OFFICER_EMAIL") && !email.safeParse(read("DPDP_GRIEVANCE_OFFICER_EMAIL")).success) {
    errors.push("DPDP_GRIEVANCE_OFFICER_EMAIL: configure a valid email address")
  }
  const backend = read("RATE_LIMIT_BACKEND")
  if (backend === "upstash") {
    if (configured("UPSTASH_REDIS_REST_URL") && !read("UPSTASH_REDIS_REST_URL").startsWith("https://")) {
      errors.push("UPSTASH_REDIS_REST_URL: HTTPS is required")
    }
    configured("UPSTASH_REDIS_REST_TOKEN")
  } else if (backend !== "mongodb") errors.push("RATE_LIMIT_BACKEND: explicitly choose mongodb or upstash")
  if (read("ENABLE_DEBUG_ROUTES") && read("ENABLE_DEBUG_ROUTES") !== "false") errors.push("ENABLE_DEBUG_ROUTES: must be false or unset")

  if (configured("RAZORPAY_KEY_ID") && !/^rzp_live_[A-Za-z0-9]+$/.test(read("RAZORPAY_KEY_ID"))) {
    errors.push("RAZORPAY_KEY_ID: production requires a live-mode key; sandbox testing is a separate prerequisite")
  }
  configured("RAZORPAY_KEY_SECRET")
  for (const name of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM", "RECAPTCHA_SECRET_KEY", "NEXT_PUBLIC_RECAPTCHA_SITE_KEY"]) configured(name)
  const port = Number(read("SMTP_PORT"))
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push("SMTP_PORT: configure a valid port")
  const from = read("EMAIL_FROM").match(/<([^>]+)>$/)?.[1] ?? read("EMAIL_FROM")
  if (read("EMAIL_FROM") && !email.safeParse(from).success) errors.push("EMAIL_FROM: configure a valid sender address")

  const google = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"]
  if (google.some(name => read(name))) {
    for (const name of google) configured(name)
    if (origins[0] && read("GOOGLE_REDIRECT_URI") !== `${origins[0]}/api/auth/google/callback`) {
      errors.push("GOOGLE_REDIRECT_URI: must match the public site origin and Google callback path")
    }
  }
  const partner = ["PARTNER_API_KEY_SECRET", "API_KEY_ENCRYPTION_SECRET"]
  if (partner.some(name => read(name))) for (const name of partner) secret(name)
  return errors
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const require = createRequire(import.meta.url)
  require("@next/env").loadEnvConfig(process.cwd(), false, {
    info() {},
    error() { console.error("Environment files could not be loaded; check their syntax locally") },
  })
  const errors = checkDeploymentEnvironment(process.env)
  if (errors.length) {
    console.error("FAIL: production configuration preflight. Values are never printed.")
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    console.log("PASS: production configuration syntax/presence checks. No database/provider calls were made.")
    console.log("Hosted configuration, credentials, indexes, sandbox journeys and release approval still require verification.")
  }
}
