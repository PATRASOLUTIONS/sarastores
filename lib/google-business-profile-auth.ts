import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"
import { z } from "zod"
import { getCollection } from "@/lib/db-service"

export const BUSINESS_PROFILE_SCOPE = "https://www.googleapis.com/auth/business.manage"
export const BUSINESS_PROFILE_PAGE = "/admin/store-locations/business-profile"
export const BUSINESS_PROFILE_CALLBACK = "/api/admin/store-locations/business-profile/callback"
export const BUSINESS_PROFILE_STATE_COOKIE = "google_business_oauth_state"
export const BUSINESS_CONNECTIONS = "google_business_connections"
export const BUSINESS_OAUTH_STATES = "google_business_oauth_states"

export class BusinessProfileError extends Error {
  constructor(message: string, public status = 503, public code = "GOOGLE_BUSINESS_UNAVAILABLE") { super(message); this.name = "BusinessProfileError" }
}
type Sealed = { ciphertext: string; iv: string; tag: string }
type Tokens = { accessToken: string; refreshToken: string; expiresAt: number; scope: string }
export interface BusinessProfileConnection {
  _id: string; ownerId: string; googleSubject: string; email: string; name: string;
  tokens: Sealed; tokenVersion: number; status: "connected" | "reconnect_required"; createdAt: Date; updatedAt: Date;
}
export interface BusinessProfileOAuthState {
  _id: string; ownerId: string; verifier: Sealed; redirectUri: string; expiresAt: Date;
}

export function businessProfileConfig() {
  const clientId = (process.env.GOOGLE_BUSINESS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "").trim()
  const clientSecret = (process.env.GOOGLE_BUSINESS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "").trim()
  const tokenSecret = process.env.GOOGLE_BUSINESS_TOKEN_SECRET || process.env.API_KEY_ENCRYPTION_SECRET || ""
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ""
  let redirectUri = process.env.GOOGLE_BUSINESS_REDIRECT_URI || ""
  try {
    if (!redirectUri && site) redirectUri = new URL(BUSINESS_PROFILE_CALLBACK, site).toString()
    const url = new URL(redirectUri)
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) ||
      url.username || url.password || url.search || url.hash || url.pathname !== BUSINESS_PROFILE_CALLBACK) redirectUri = ""
  } catch { redirectUri = "" }
  const missing = [!clientId && "GOOGLE_BUSINESS_CLIENT_ID (or GOOGLE_CLIENT_ID)",
    !clientSecret && "GOOGLE_BUSINESS_CLIENT_SECRET (or GOOGLE_CLIENT_SECRET)",
    tokenSecret.length < 32 && "GOOGLE_BUSINESS_TOKEN_SECRET (at least 32 characters, or API_KEY_ENCRYPTION_SECRET)",
    !redirectUri && "GOOGLE_BUSINESS_REDIRECT_URI (or a valid site URL)"]
    .filter((value): value is string => !!value)
  return { clientId, clientSecret, tokenSecret, redirectUri, missing, configured: missing.length === 0 }
}
function requireConfig() {
  const config = businessProfileConfig()
  if (!config.configured) throw new BusinessProfileError("Google Business Profile connection is not configured. Complete the setup shown on the connection page.", 503, "NOT_CONFIGURED")
  return config
}
export function sealBusinessSecret(value: unknown, binding: string): Sealed {
  const { tokenSecret } = requireConfig()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(tokenSecret).digest(), iv)
  cipher.setAAD(Buffer.from(binding))
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()])
  return { ciphertext: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") }
}
export function openBusinessSecret(value: Sealed, binding: string): unknown {
  const { tokenSecret } = requireConfig()
  try {
    const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(tokenSecret).digest(), Buffer.from(value.iv, "base64"))
    decipher.setAAD(Buffer.from(binding)); decipher.setAuthTag(Buffer.from(value.tag, "base64"))
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8"))
  } catch { throw new BusinessProfileError("The stored Google connection cannot be decrypted. Restore the original token encryption secret or reconnect the Google account.", 503, "RECONNECT_REQUIRED") }
}
export const businessStateHash = (state: string) => createHash("sha256").update(state).digest("hex")
export function createBusinessOAuthState(ownerId: string) {
  const config = requireConfig()
  const state = randomBytes(32).toString("base64url")
  const verifier = randomBytes(48).toString("base64url")
  const id = businessStateHash(state)
  const record: BusinessProfileOAuthState = { _id: id, ownerId, verifier: sealBusinessSecret({ verifier }, `${ownerId}:${id}`),
    redirectUri: config.redirectUri, expiresAt: new Date(Date.now() + 10 * 60000) }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  for (const [key, value] of Object.entries({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code",
    scope: `openid email profile ${BUSINESS_PROFILE_SCOPE}`, access_type: "offline", prompt: "consent select_account",
    state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" })) url.searchParams.set(key, value)
  return { state, record, url: url.toString() }
}
const tokensSchema = z.object({ accessToken: z.string().min(1), refreshToken: z.string().min(1), expiresAt: z.number(), scope: z.string() })
const tokenResponseSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(), expires_in: z.number().positive(), scope: z.string().optional() })

async function googleTokenRequest(fields: Record<string, string>) {
  const config = requireConfig()
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields }), signal: AbortSignal.timeout(15000), cache: "no-store" })
  if (!response.ok) {
    let reason = ""
    try { reason = z.object({ error: z.string().optional() }).parse(await response.json()).error || "" } catch { /* Do not expose provider errors or credentials. */ }
    if (reason === "invalid_client") throw new BusinessProfileError("Check the configured Google OAuth client ID and client secret.", 503, "NOT_CONFIGURED")
    if (reason === "invalid_grant" || response.status === 401) throw new BusinessProfileError("Google authorization expired or was revoked. Reconnect this Google account.", 401, "RECONNECT_REQUIRED")
    throw new BusinessProfileError("Google token authorization failed. Check the OAuth redirect URI or try again later.", 503, "GOOGLE_TOKEN_UNAVAILABLE")
  }
  return tokenResponseSchema.parse(await response.json())
}
export async function finishBusinessConnection(ownerId: string, code: string, state: BusinessProfileOAuthState) {
  const { verifier } = z.object({ verifier: z.string().min(1) }).parse(openBusinessSecret(state.verifier, `${ownerId}:${state._id}`))
  const response = await googleTokenRequest({ code, code_verifier: verifier, redirect_uri: state.redirectUri, grant_type: "authorization_code" })
  if (!response.scope?.split(" ").includes(BUSINESS_PROFILE_SCOPE)) throw new BusinessProfileError("Google Business Profile permission was not granted. Reconnect and allow access to your business profiles.", 403, "SCOPE_REQUIRED")
  const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${response.access_token}` }, signal: AbortSignal.timeout(10000), cache: "no-store" })
  if (!identityResponse.ok) throw new BusinessProfileError("Google account identity could not be confirmed. Try connecting again.", 401, "IDENTITY_FAILED")
  const identity = z.object({ sub: z.string().min(1), email: z.string().email(), email_verified: z.literal(true), name: z.string().optional() }).parse(await identityResponse.json())
  const id = createHash("sha256").update(`${ownerId}:${identity.sub}`).digest("hex")
  const collection = await getCollection<BusinessProfileConnection>(BUSINESS_CONNECTIONS)
  const existing = await collection.findOne({ _id: id, ownerId })
  let previous: Tokens | null = null
  if (!response.refresh_token && existing) {
    try { previous = tokensSchema.parse(openBusinessSecret(existing.tokens, `${ownerId}:${id}`)) } catch { /* A new offline grant is required if the previous secret cannot be decrypted. */ }
  }
  const refreshToken = response.refresh_token || previous?.refreshToken
  if (!refreshToken) throw new BusinessProfileError("Google did not issue offline access. Remove this app's access in your Google account permissions, then connect again.", 400, "OFFLINE_ACCESS_REQUIRED")
  const tokens: Tokens = { accessToken: response.access_token, refreshToken, expiresAt: Date.now() + response.expires_in * 1000, scope: response.scope }
  const now = new Date()
  await collection.updateOne({ _id: id, ownerId }, { $set: { ownerId, googleSubject: identity.sub, email: identity.email.toLowerCase(),
    name: identity.name || identity.email, tokens: sealBusinessSecret(tokens, `${ownerId}:${id}`), status: "connected", updatedAt: now },
    $inc: { tokenVersion: 1 }, $setOnInsert: { createdAt: now } }, { upsert: true })
  return id
}
export async function ownedBusinessConnection(ownerId: string, id: string) {
  const connection = await (await getCollection<BusinessProfileConnection>(BUSINESS_CONNECTIONS)).findOne({ _id: id, ownerId })
  if (!connection) throw new BusinessProfileError("Google connection not found for your admin account.", 404, "CONNECTION_NOT_FOUND")
  return connection
}
const refreshes = new Map<string, Promise<string>>()
export async function businessAccessToken(ownerId: string, id: string): Promise<string> {
  const connection = await ownedBusinessConnection(ownerId, id)
  if (connection.status !== "connected") throw new BusinessProfileError("Reconnect this Google account to restore Business Profile access.", 401, "RECONNECT_REQUIRED")
  const tokens = tokensSchema.parse(openBusinessSecret(connection.tokens, `${ownerId}:${id}`))
  if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken
  const pending = refreshes.get(id)
  if (pending) return pending
  const promise = (async () => {
    let response: z.infer<typeof tokenResponseSchema>
    try { response = await googleTokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refreshToken }) }
    catch (error) {
      if (error instanceof BusinessProfileError && error.code === "RECONNECT_REQUIRED") await (await getCollection<BusinessProfileConnection>(BUSINESS_CONNECTIONS)).updateOne({ _id: id, ownerId, tokenVersion: connection.tokenVersion }, { $set: { status: "reconnect_required", updatedAt: new Date() } })
      throw error
    }
    const updated: Tokens = { accessToken: response.access_token, refreshToken: response.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + response.expires_in * 1000, scope: response.scope || tokens.scope }
    const result = await (await getCollection<BusinessProfileConnection>(BUSINESS_CONNECTIONS)).updateOne({ _id: id, ownerId, tokenVersion: connection.tokenVersion }, {
      $set: { tokens: sealBusinessSecret(updated, `${ownerId}:${id}`), updatedAt: new Date() }, $inc: { tokenVersion: 1 },
    })
    if (!result.matchedCount) {
      const latest = await ownedBusinessConnection(ownerId, id)
      if (latest.status !== "connected") throw new BusinessProfileError("Reconnect your Google account.", 401, "RECONNECT_REQUIRED")
      return tokensSchema.parse(openBusinessSecret(latest.tokens, `${ownerId}:${id}`)).accessToken
    }
    return updated.accessToken
  })()
  refreshes.set(id, promise)
  try { return await promise } finally { if (refreshes.get(id) === promise) refreshes.delete(id) }
}
export async function disconnectBusinessConnection(ownerId: string, id: string) {
  await ownedBusinessConnection(ownerId, id)
  await (await getCollection<BusinessProfileConnection>(BUSINESS_CONNECTIONS)).deleteOne({ _id: id, ownerId })
}
