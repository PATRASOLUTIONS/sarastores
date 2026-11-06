import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { getConfiguredSiteOrigin } from "@/lib/site-origin"
import type { MerchantProductInput } from "@/lib/google-merchant-products"

export const MERCHANT_BATCH_SIZE = 5
export class MerchantError extends Error {
  constructor(message: string, public status = 400) { super(message); this.name = "MerchantError" }
}
export function merchantConfig() {
  const accountId = (process.env.GOOGLE_MERCHANT_ACCOUNT_ID || "").trim()
  const dataSourceId = (process.env.GOOGLE_MERCHANT_DATA_SOURCE_ID || "").trim()
  const feedLabel = (process.env.GOOGLE_MERCHANT_FEED_LABEL || "IN").trim()
  const clientId = (process.env.GOOGLE_MERCHANT_CLIENT_ID || "").trim()
  const clientSecret = process.env.GOOGLE_MERCHANT_CLIENT_SECRET || ""
  const refreshToken = process.env.GOOGLE_MERCHANT_REFRESH_TOKEN || ""
  const signingSecret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || ""
  const origin = getConfiguredSiteOrigin()
  const missing = [
    !/^\d+$/.test(accountId) && "GOOGLE_MERCHANT_ACCOUNT_ID",
    !/^\d+$/.test(dataSourceId) && "GOOGLE_MERCHANT_DATA_SOURCE_ID",
    !/^[A-Z0-9_-]{1,20}$/.test(feedLabel) && "GOOGLE_MERCHANT_FEED_LABEL",
    !clientId && "GOOGLE_MERCHANT_CLIENT_ID", !clientSecret && "GOOGLE_MERCHANT_CLIENT_SECRET",
    !refreshToken && "GOOGLE_MERCHANT_REFRESH_TOKEN", signingSecret.length < 16 && "SESSION_SECRET",
    (!origin || !origin.startsWith("https://")) && "NEXT_PUBLIC_SITE_URL (public HTTPS origin)",
  ].filter((value): value is string => !!value)
  return { accountId, dataSourceId, feedLabel, clientId, clientSecret, refreshToken, signingSecret, origin, missing }
}
export function merchantPayloadDigest(inputs: MerchantProductInput[]): string {
  return createHash("sha256").update(JSON.stringify(inputs)).digest("hex")
}
const previewSchema = z.object({ ownerId: z.string().min(1), accountId: z.string(), dataSourceId: z.string(),
  feedLabel: z.string(), ids: z.array(z.string().min(1).max(200)).min(1).max(MERCHANT_BATCH_SIZE),
  digest: z.string().regex(/^[a-f0-9]{64}$/), expiresAt: z.number() }).strict()
export function signMerchantPreview(ownerId: string, ids: string[], inputs: MerchantProductInput[]): string | null {
  const config = merchantConfig()
  if (config.missing.length || !ids.length) return null
  const value = Buffer.from(JSON.stringify({ ownerId, ids, accountId: config.accountId, dataSourceId: config.dataSourceId,
    feedLabel: config.feedLabel, digest: merchantPayloadDigest(inputs), expiresAt: Date.now() + 10 * 60000 })).toString("base64url")
  return `${value}.${createHmac("sha256", config.signingSecret).update(value).digest("base64url")}`
}
export function verifyMerchantPreview(token: string, ownerId: string) {
  const config = merchantConfig()
  if (config.missing.length) throw new MerchantError("Complete the Merchant API configuration before submitting.", 503)
  try {
    const [value, signature, extra] = token.split(".")
    if (!value || !signature || extra || token.length > 5000) throw new Error()
    const expected = createHmac("sha256", config.signingSecret).update(value).digest()
    const received = Buffer.from(signature, "base64url")
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) throw new Error()
    const preview = previewSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")))
    if (preview.ownerId !== ownerId || preview.expiresAt < Date.now() || preview.accountId !== config.accountId
      || preview.dataSourceId !== config.dataSourceId || preview.feedLabel !== config.feedLabel
      || new Set(preview.ids).size !== preview.ids.length) throw new Error()
    return preview
  } catch { throw new MerchantError("The preview expired or changed. Generate a new preview before submitting.", 409) }
}
async function merchantToken(): Promise<string> {
  const config = merchantConfig()
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: config.clientId,
      client_secret: config.clientSecret, refresh_token: config.refreshToken }) })
  if (!response.ok) throw new MerchantError("Google authorization failed. Check the dedicated Merchant OAuth setup.", 503)
  const token = z.object({ access_token: z.string().min(1), scope: z.string().optional() }).safeParse(await response.json())
  if (!token.success || (token.data.scope && !token.data.scope.split(" ").includes("https://www.googleapis.com/auth/content"))) {
    throw new MerchantError("Google Merchant permission was not granted.", 403)
  }
  return token.data.access_token
}
export interface MerchantSubmissionResult { offerId: string; status: "submitted" | "failed" | "unknown" | "not-sent"; message: string }
export async function submitMerchantInputs(inputs: MerchantProductInput[]): Promise<MerchantSubmissionResult[]> {
  const config = merchantConfig()
  if (config.missing.length || !inputs.length || inputs.length > MERCHANT_BATCH_SIZE) throw new MerchantError("Merchant configuration or batch is invalid.", 503)
  const deadline = Date.now() + 45000
  const token = await merchantToken()
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  const sourceName = `accounts/${config.accountId}/dataSources/${config.dataSourceId}`
  const signal = () => AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - Date.now())))
  const sourceResponse = await fetch(`https://merchantapi.googleapis.com/datasources/v1/${sourceName}`, { headers, signal: signal(), cache: "no-store" })
  if (!sourceResponse.ok) throw new MerchantError("The configured Merchant data source could not be verified. Check account access and data-source ID.", 503)
  const source = z.object({ name: z.string(), input: z.literal("API"), primaryProductDataSource: z.object({
    legacyLocal: z.boolean().optional(), feedLabel: z.string().optional(), contentLanguage: z.string().optional(), countries: z.array(z.string()).optional(),
  }) }).safeParse(await sourceResponse.json())
  if (!source.success || source.data.name !== sourceName || source.data.primaryProductDataSource.legacyLocal
    || (source.data.primaryProductDataSource.feedLabel && source.data.primaryProductDataSource.feedLabel !== config.feedLabel)
    || (source.data.primaryProductDataSource.contentLanguage && source.data.primaryProductDataSource.contentLanguage !== "en")
    || !source.data.primaryProductDataSource.countries?.includes("IN")) {
    throw new MerchantError("Use an online primary API data source configured for India, English and the matching feed label.", 409)
  }
  // Verify ownership of every existing offer before the first write. Insert can otherwise move products between sources.
  for (const input of inputs) {
    const name = Buffer.from(`${input.contentLanguage}~${input.feedLabel}~${input.offerId}`).toString("base64url")
    const response = await fetch(`https://merchantapi.googleapis.com/products/v1/accounts/${config.accountId}/products/${name}`, { headers, signal: signal(), cache: "no-store" })
    if (response.status === 404) continue
    if (!response.ok) throw new MerchantError("Existing Merchant product ownership could not be verified. No products were sent.", 503)
    const product = z.object({ dataSource: z.string() }).safeParse(await response.json())
    if (!product.success || product.data.dataSource !== sourceName) throw new MerchantError(`Product ${input.offerId} belongs to another data source. No products were sent.`, 409)
  }
  const results: MerchantSubmissionResult[] = []
  for (const input of inputs) {
    if (Date.now() > deadline - 2000 || results.some(result => result.status !== "submitted")) {
      results.push({ offerId: input.offerId, status: "not-sent", message: "Batch stopped. Review previous results before preparing a new preview." }); continue
    }
    try {
      const url = new URL(`https://merchantapi.googleapis.com/products/v1/accounts/${config.accountId}/productInputs:insert`)
      url.searchParams.set("dataSource", sourceName)
      const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(input), signal: signal(), cache: "no-store" })
      results.push({ offerId: input.offerId, status: response.ok ? "submitted" : "failed",
        message: response.ok ? "Input received by Google; listing approval is pending Google's processing." : `Google rejected the request (HTTP ${response.status}). Check Merchant diagnostics.` })
    } catch {
      results.push({ offerId: input.offerId, status: "unknown", message: "The connection ended before confirmation. Check this item in Merchant Center before retrying." })
    }
  }
  return results
}
